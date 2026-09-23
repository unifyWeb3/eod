// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./FinalityEscrow.sol";

/// @notice Fixed provenance root for application escrows.
///
/// This factory has no owner, implementation pointer, registration function,
/// or settlement authority. It can only deploy the exact FinalityEscrow
/// creation code in this source file. A deployment key includes every
/// immutable binding and the actual buyer is always msg.sender, then passed to
/// the escrow constructor explicitly because this factory is the EVM creator.
contract FinalityEscrowFactory {
    bytes32 public constant FACTORY_VERSION = bytes32("EOD-ESCROW-FACTORY-V1");

    mapping(bytes32 => address) public escrowForKey;

    event EscrowDeployed(
        bytes32 indexed deploymentKey,
        address indexed escrow,
        address indexed buyer,
        address seller,
        address authorizedSource,
        uint256 amount
    );

    function deploymentKey(
        address buyer,
        address seller,
        address authorizedSource,
        uint256 sourceChainId,
        uint256 settlementChainId,
        bytes32 jobId,
        bytes32 policyCommitment,
        bytes32 evidenceCommitment,
        uint256 amount
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                buyer,
                seller,
                authorizedSource,
                sourceChainId,
                settlementChainId,
                jobId,
                policyCommitment,
                evidenceCommitment,
                amount
            )
        );
    }

    function deployEscrow(
        address seller,
        address authorizedSource,
        uint256 sourceChainId,
        uint256 settlementChainId,
        bytes32 jobId,
        bytes32 policyCommitment,
        bytes32 evidenceCommitment
    ) external payable returns (address escrowAddress) {
        require(msg.value > 0, "fund me");
        require(seller != address(0), "zero seller");
        require(authorizedSource != address(0), "zero source");
        require(settlementChainId == block.chainid, "settlement chain mismatch");
        require(sourceChainId == settlementChainId, "source chain mismatch");

        bytes32 key = deploymentKey(
            msg.sender,
            seller,
            authorizedSource,
            sourceChainId,
            settlementChainId,
            jobId,
            policyCommitment,
            evidenceCommitment,
            msg.value
        );
        require(escrowForKey[key] == address(0), "escrow already deployed");

        FinalityEscrow escrow = new FinalityEscrow{salt: key, value: msg.value}(
            msg.sender,
            seller,
            authorizedSource,
            sourceChainId,
            settlementChainId,
            jobId,
            policyCommitment,
            evidenceCommitment
        );
        escrowAddress = address(escrow);
        escrowForKey[key] = escrowAddress;

        emit EscrowDeployed(key, escrowAddress, msg.sender, seller, authorizedSource, msg.value);
    }
}
