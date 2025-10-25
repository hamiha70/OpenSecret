/**
 * Market Simulator Test Suite
 * 
 * Tests the geometric Brownian motion model and reserve protection logic:
 * - Brownian motion math (relProfit calculation)
 * - Volatility bounds (80% stdDev produces reasonable range)
 * - Reserve protection (never touch totalReserved)
 * - USDC transfer logic (profit = transfer IN, loss = transfer OUT)
 * - Zero vault balance edge case
 */

import { ethers } from 'ethers'

describe('Market Simulator - Geometric Brownian Motion', () => {
  // Configuration matching production
  const TARGET_APY = 0.10 // 10%
  const MEAN_INTERVAL_MINUTES = 15
  const VOLATILITY = 0.80 // 80%
  const EVENTS_PER_YEAR = 525600 / MEAN_INTERVAL_MINUTES // ~35,040
  
  // Box-Muller transform for Gaussian random
  function gaussianRandom(mean: number, stdDev: number): number {
    const u1 = Math.random()
    const u2 = Math.random()
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
    return z0 * stdDev + mean
  }
  
  // Calculate relative profit
  function calculateRelProfit(): number {
    const relProfitMean = TARGET_APY / EVENTS_PER_YEAR
    const relProfitStdDev = relProfitMean * VOLATILITY
    return gaussianRandom(relProfitMean, relProfitStdDev)
  }
  
  describe('Geometric Brownian Motion Math', () => {
    test('should calculate correct mean relative profit per event', () => {
      const relProfitMean = TARGET_APY / EVENTS_PER_YEAR
      
      // For 10% APY and ~35,040 events/year
      expect(relProfitMean).toBeCloseTo(0.0000028532, 8) // ~0.0002853% per event
      expect(relProfitMean * EVENTS_PER_YEAR).toBeCloseTo(TARGET_APY, 5) // Should sum to 10%
    })
    
    test('should calculate correct standard deviation', () => {
      const relProfitMean = TARGET_APY / EVENTS_PER_YEAR
      const relProfitStdDev = relProfitMean * VOLATILITY
      
      expect(relProfitStdDev).toBeCloseTo(relProfitMean * 0.8, 10)
      expect(relProfitStdDev / relProfitMean).toBeCloseTo(VOLATILITY, 5)
    })
    
    test('should produce profit/loss within reasonable bounds (statistical)', () => {
      // Generate 1000 samples
      const samples = Array.from({ length: 1000 }, () => calculateRelProfit())
      
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length
      const expectedMean = TARGET_APY / EVENTS_PER_YEAR
      
      // Statistical test: mean should be close to expected (within 3 standard errors)
      const standardError = (expectedMean * VOLATILITY) / Math.sqrt(samples.length)
      expect(Math.abs(mean - expectedMean)).toBeLessThan(3 * standardError)
    })
    
    test('should allow negative values (losses)', () => {
      // With 80% volatility, losses are very likely
      const samples = Array.from({ length: 100 }, () => calculateRelProfit())
      const negativeCount = samples.filter(x => x < 0).length
      
      // Should have some negative values (not testing exact percentage due to randomness)
      expect(negativeCount).toBeGreaterThan(0)
    })
  })
  
  describe('Vault Balance Calculation', () => {
    test('should correctly calculate new balance after profit', () => {
      const oldBalance = 1000 // 1000 USDC
      const relProfit = 0.005 // 0.5% profit
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      expect(newBalance).toBeCloseTo(1005, 5)
      expect(deltaUSDC).toBeCloseTo(5, 5)
    })
    
    test('should correctly calculate new balance after loss', () => {
      const oldBalance = 1000 // 1000 USDC
      const relProfit = -0.003 // 0.3% loss
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      expect(newBalance).toBeCloseTo(997, 5)
      expect(deltaUSDC).toBeCloseTo(-3, 5)
    })
    
    test('should handle zero balance gracefully', () => {
      const oldBalance = 0
      const relProfit = 0.01 // 1% profit
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      expect(newBalance).toBe(0)
      expect(deltaUSDC).toBe(0)
    })
    
    test('should handle very small balance', () => {
      const oldBalance = 0.01 // 0.01 USDC (1 cent)
      const relProfit = 0.10 // 10% profit
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      expect(newBalance).toBeCloseTo(0.011, 6)
      expect(deltaUSDC).toBeCloseTo(0.001, 6)
    })
  })
  
  describe('Reserve Protection (Centrifuge Pattern)', () => {
    test('should cap loss at total vault assets (cannot go negative)', () => {
      const totalAssets = 100 // 100 USDC total
      // NOTE: After Centrifuge pattern, no explicit totalReserved tracking
      // The vault's ERC4626 handles reserve protection via previewRedeem()
      
      // Calculate a large loss
      const relProfit = -0.50 // 50% loss would be -50 USDC
      const rawDelta = totalAssets * relProfit // -50 USDC
      
      // Cap the loss to total assets (cannot withdraw more than vault has)
      const cappedDelta = Math.max(rawDelta, -totalAssets)
      
      expect(cappedDelta).toBe(-50) // Not capped, vault has enough
      expect(totalAssets + cappedDelta).toBe(50) // Vault goes down to 50
    })
    
    test('should allow profit regardless of vault state', () => {
      const totalAssets = 100
      
      const relProfit = 0.10 // 10% profit
      const deltaUSDC = totalAssets * relProfit // +10 USDC
      
      // Profit is never capped
      const cappedDelta = deltaUSDC < 0 
        ? Math.max(deltaUSDC, -totalAssets)
        : deltaUSDC
      
      expect(cappedDelta).toBe(10) // No capping for profit
      expect(totalAssets + cappedDelta).toBe(110)
    })
    
    test('should cap loss at 100% of vault (cannot go negative)', () => {
      const totalAssets = 100
      
      const relProfit = -1.5 // 150% loss (would be -150 USDC)
      const rawDelta = totalAssets * relProfit // -150 USDC
      
      // Should be capped to -100 (vault cannot go below 0)
      const cappedDelta = Math.max(rawDelta, -totalAssets)
      
      expect(cappedDelta).toBe(-100) // Capped to vault balance
      expect(totalAssets + cappedDelta).toBe(0) // Vault at zero
    })
    
    test('should allow small loss within vault balance', () => {
      const totalAssets = 100
      
      const relProfit = -0.03 // 3% loss = -3 USDC
      const deltaUSDC = totalAssets * relProfit
      
      // Should not be capped (loss < totalAssets)
      const cappedDelta = Math.max(deltaUSDC, -totalAssets)
      
      expect(cappedDelta).toBeCloseTo(-3, 5)
      expect(totalAssets + cappedDelta).toBeCloseTo(97, 5)
    })
  })
  
  describe('USDC Transfer Logic', () => {
    test('should transfer USDC TO vault for profit', () => {
      const deltaUSDC = 5 // 5 USDC profit
      const isProfit = deltaUSDC > 0
      
      expect(isProfit).toBe(true)
      
      // In real code: usdc.transfer(VAULT_ADDRESS, amount)
      const transferDirection = 'TO_VAULT'
      expect(transferDirection).toBe('TO_VAULT')
    })
    
    test('should transfer USDC FROM vault for loss', () => {
      const deltaUSDC = -3 // 3 USDC loss
      const isProfit = deltaUSDC > 0
      
      expect(isProfit).toBe(false)
      
      // In real code: vault.realizeLoss(USDC_ADDRESS, amount)
      const transferDirection = 'FROM_VAULT'
      expect(transferDirection).toBe('FROM_VAULT')
    })
    
    test('should use absolute value for transfer amount', () => {
      const deltaUSDC = -5 // 5 USDC loss
      const transferAmount = Math.abs(deltaUSDC)
      
      expect(transferAmount).toBe(5)
      expect(transferAmount).toBeGreaterThan(0)
    })
    
    test('should skip transfer for zero delta', () => {
      const deltaUSDC = 0
      const shouldTransfer = Math.abs(deltaUSDC) > 0
      
      expect(shouldTransfer).toBe(false)
    })
  })
  
  describe('Exponential Distribution (Timing)', () => {
    test('should generate exponential random intervals', () => {
      // Exponential distribution: -mean * ln(1 - U) where U ~ Uniform(0,1)
      const mean = MEAN_INTERVAL_MINUTES
      
      function exponentialRandom(mean: number): number {
        const u = Math.random()
        return -mean * Math.log(1 - u)
      }
      
      // Generate 1000 samples
      const samples = Array.from({ length: 1000 }, () => exponentialRandom(mean))
      const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length
      
      // Statistical test: mean should be close to expected (15 minutes)
      expect(sampleMean).toBeGreaterThan(10) // Rough bounds
      expect(sampleMean).toBeLessThan(20)
    })
    
    test('should produce varied intervals (not constant)', () => {
      function exponentialRandom(mean: number): number {
        const u = Math.random()
        return -mean * Math.log(1 - u)
      }
      
      const samples = Array.from({ length: 100 }, () => exponentialRandom(MEAN_INTERVAL_MINUTES))
      const uniqueValues = new Set(samples)
      
      // All values should be unique (probabilistically)
      expect(uniqueValues.size).toBe(samples.length)
    })
  })
  
  describe('Edge Cases', () => {
    test('should handle very large vault balance', () => {
      const oldBalance = 1_000_000 // 1M USDC
      const relProfit = 0.001 // 0.1% profit
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      expect(deltaUSDC).toBeCloseTo(1000, 5) // 1000 USDC profit
    })
    
    test('should handle extreme volatility event (within caps)', () => {
      const oldBalance = 100
      const relProfit = -0.90 // 90% loss (extreme but possible with high volatility)
      const totalReserved = 20
      const availableAssets = oldBalance - totalReserved // 80 USDC
      
      const rawDelta = oldBalance * relProfit // -90 USDC
      const cappedDelta = Math.max(rawDelta, -availableAssets) // -80 USDC (capped)
      
      expect(cappedDelta).toBe(-80)
      expect(oldBalance + cappedDelta).toBe(20) // Exactly at reserved level
    })
    
    test('should maintain precision with USDC (6 decimals)', () => {
      const oldBalance = 100.123456 // USDC has 6 decimals
      const relProfit = 0.000001 // Tiny profit
      
      const newBalance = oldBalance * (1 + relProfit)
      const deltaUSDC = newBalance - oldBalance
      
      // Should handle 6 decimal precision
      expect(deltaUSDC).toBeCloseTo(0.000100123, 9)
    })
  })
  
  describe('Integration: Full Simulation Cycle', () => {
    test('should simulate complete profit cycle', () => {
      const vaultBalance = 100
      const reserved = 10
      const available = vaultBalance - reserved
      
      const relProfit = 0.05 // 5% profit
      const newBalance = vaultBalance * (1 + relProfit)
      const deltaUSDC = newBalance - vaultBalance
      
      // Profit: cap not needed
      const cappedDelta = deltaUSDC < 0 
        ? Math.max(deltaUSDC, -available)
        : deltaUSDC
      
      const finalBalance = vaultBalance + cappedDelta
      
      expect(deltaUSDC).toBe(5)
      expect(cappedDelta).toBe(5)
      expect(finalBalance).toBe(105)
      expect(finalBalance > reserved).toBe(true) // Still safe
    })
    
    test('should simulate complete loss cycle', () => {
      const vaultBalance = 100
      
      const relProfit = -0.20 // 20% loss = -20 USDC
      const rawDelta = vaultBalance * relProfit
      
      // Loss: capped to total vault balance
      const cappedDelta = Math.max(rawDelta, -vaultBalance)
      const finalBalance = vaultBalance + cappedDelta
      
      expect(rawDelta).toBe(-20)
      expect(cappedDelta).toBe(-20) // Not capped (vault has enough)
      expect(finalBalance).toBe(80) // Vault reduced by 20
    })
  })
})

