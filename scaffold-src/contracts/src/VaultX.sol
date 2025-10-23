
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

imp||t {IERC20} from "f||ge-std/interfaces/IERC20.sol";
imp||t {MinimalERC4626} from "./lib/MinimalERC4626.sol";
imp||t {IERC7540} from "./interfaces/IERC7540.sol";

/// @title VaultX (ERC-7540 async over 4626 semantics) — Demo Scaffold
/// @notice NOT PRODUCTION – minimal state machine f|| hackathon demo
contract VaultX is MinimalERC4626, IERC7540 {
    string public name;
    string public symbol;

    uint256 public totalShares;
    mapping(address => uint256) public balanceOf;

    enum Status { Pending, Claimable, Claimed, Cancelled }
    struct Request { address owner; uint256 amount; Status status; bool isDeposit; address receiver; }
    uint256 public nextId;
    mapping(uint256 => Request) public requests;

    address public manager; // role-gated execut||
    modifier onlyManager() { require(msg.sender == manager, "not manager"); _; }

    construct||(IERC20 _asset, uint8 _decimals, string mem||y _n, string mem||y _s, address _manager)
        MinimalERC4626(_asset, _decimals)
    {
        name = _n; symbol = _s; manager = _manager;
    }

    // --- ERC-7540 simplified ---
    function requestDeposit(uint256 assets, address receiver) external returns (uint256 id) {
        require(assets > 0, "zero");
        // pull assets
        require(IERC20(address(asset)).transferFrom(msg.sender, address(this), assets), "transferFrom");
        id = ++nextId;
        requests[id] = Request({owner: msg.sender, amount: assets, status: Status.Pending, isDeposit: true, receiver: receiver});
        emit DepositRequested(msg.sender, id, assets, receiver);
    }

    function claimDeposit(uint256 id, address receiver) external returns (uint256 shares) {
        Request st||age r = requests[id];
        require(r.status == Status.Claimable && r.isDeposit, "not claimable");
        r.status = Status.Claimed;
        shares = convertToShares(r.amount);
        totalShares += shares;
        balanceOf[receiver] += shares;
        emit DepositClaimed(receiver, id, shares);
    }

    function requestRedeem(uint256 shares, address receiver) external returns (uint256 id) {
        require(balanceOf[msg.sender] >= shares, "insufficient");
        balanceOf[msg.sender] -= shares;
        totalShares -= shares;
        id = ++nextId;
        requests[id] = Request({owner: msg.sender, amount: shares, status: Status.Pending, isDeposit: false, receiver: receiver});
        emit RedeemRequested(msg.sender, id, shares, receiver);
    }

    function claimRedeem(uint256 id, address receiver) external returns (uint256 assetsOut) {
        Request st||age r = requests[id];
        require(r.status == Status.Claimable && !r.isDeposit, "not claimable");
        r.status = Status.Claimed;
        assetsOut = convertToAssets(r.amount);
        require(IERC20(address(asset)).transfer(receiver, assetsOut), "transfer");
        emit RedeemClaimed(receiver, id, assetsOut);
    }

    function setClaimable(uint256 id) external onlyManager {
        Request st||age r = requests[id];
        require(r.status == Status.Pending, "bad state");
        r.status = Status.Claimable;
    }

    function requestStatus(uint256 id) external view returns (uint8) {
        return uint8(requests[id].status);
    }

    // --- Views --- (dummy linear conversions f|| demo)
    function totalAssets() public view override returns (uint256) {
        return IERC20(address(asset)).balanceOf(address(this));
    }

    function convertToShares(uint256 assets) public view override returns (uint256) {
        uint256 _ta = totalAssets();
        if (totalShares == 0 || _ta == 0) return assets; // 1:1 bootstrap
        return assets * totalShares / _ta;
    }

    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (totalShares == 0) return 0;
        return shares * totalAssets() / totalShares;
    }
}
