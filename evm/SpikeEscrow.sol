// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// Day-1 spike escrow (Base Sepolia): buyer funds on deploy; only the
/// arbiter (verdict relayer) can release to seller or refund to buyer.
/// Arbiter acts ONLY after a GenLayer FINALIZED + FINISHED_WITH_RETURN
/// ACCEPT/REJECT receipt (enforced offchain in spike, onchain allowlist later).
contract SpikeEscrow {
    address public buyer;
    address public seller;
    address public arbiter;
    bool public released;
    bool public refunded;

    event Funded(address indexed buyer, uint256 amount);
    event Released(address indexed seller, uint256 amount);
    event Refunded(address indexed buyer, uint256 amount);

    constructor(address _seller, address _arbiter) payable {
        require(msg.value > 0, "fund me");
        require(_seller != address(0) && _arbiter != address(0), "zero addr");
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        emit Funded(msg.sender, msg.value);
    }

    function release() external {
        require(msg.sender == arbiter, "not arbiter");
        require(!released && !refunded, "settled");
        released = true;
        uint256 amt = address(this).balance;
        (bool ok, ) = payable(seller).call{value: amt}("");
        require(ok, "xfer fail");
        emit Released(seller, amt);
    }

    function refund() external {
        require(msg.sender == arbiter, "not arbiter");
        require(!released && !refunded, "settled");
        refunded = true;
        uint256 amt = address(this).balance;
        (bool ok, ) = payable(buyer).call{value: amt}("");
        require(ok, "xfer fail");
        emit Refunded(buyer, amt);
    }
}
