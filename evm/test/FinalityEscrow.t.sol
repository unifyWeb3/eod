// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "../FinalityEscrow.sol";
import "../FinalityEscrowFactory.sol";

interface Vm {
    function deal(address who, uint256 newBalance) external;
    function prank(address sender) external;
    function expectRevert(bytes calldata) external;
    function readFile(string calldata path) external view returns (string memory);
    function parseJsonString(string calldata json, string calldata key) external pure returns (string memory);
    function parseJsonAddress(string calldata json, string calldata key) external pure returns (address);
    function parseJsonBytes32(string calldata json, string calldata key) external pure returns (bytes32);
    function parseJsonUint(string calldata json, string calldata key) external pure returns (uint256);
}

contract GasBombRecipient {
    fallback() external payable {
        assembly {
            invalid()
        }
    }
}

contract GasExhaustingRecipient {
    function withdrawFrom(FinalityEscrow escrow) external {
        escrow.withdraw();
    }

    fallback() external payable {
        assembly {
            invalid()
        }
    }
}

contract ToggleRecipient {
    FinalityEscrow public escrow;
    bool public rejectPayments;
    bool public reenter;
    bool public reentrySucceeded;
    uint256 public receiveAttempts;

    function setEscrow(FinalityEscrow _escrow) external {
        escrow = _escrow;
    }

    function setRejectPayments(bool value) external {
        rejectPayments = value;
    }

    function setReenter(bool value) external {
        reenter = value;
    }

    function withdrawFrom() external {
        escrow.withdraw();
    }

    receive() external payable {
        receiveAttempts += 1;
        if (rejectPayments) revert("recipient unavailable");
        if (reenter) {
            (bool ok,) = address(escrow).call(abi.encodeWithSignature("withdraw()"));
            if (ok) reentrySucceeded = true;
        }
    }
}

/// @dev Deliberately has every acceptance-side getter but no receipt-gated
/// settlement behavior. It models the contract that typed getter equality
/// alone could not exclude before the fixed factory provenance check.
contract GetterLookalike {
    address public immutable buyer;
    address public immutable seller;
    address public immutable authorizedSource;
    uint256 public immutable sourceChainId;
    uint256 public immutable settlementChainId;
    bytes32 public immutable jobId;
    bytes32 public immutable policyCommitment;
    bytes32 public immutable evidenceCommitment;
    uint256 public immutable fundedAmount;

    constructor(
        address _buyer,
        address _seller,
        address _source,
        uint256 _sourceChainId,
        uint256 _settlementChainId,
        bytes32 _job,
        bytes32 _policy,
        bytes32 _evidence,
        uint256 _amount
    ) {
        buyer = _buyer;
        seller = _seller;
        authorizedSource = _source;
        sourceChainId = _sourceChainId;
        settlementChainId = _settlementChainId;
        jobId = _job;
        policyCommitment = _policy;
        evidenceCommitment = _evidence;
        fundedAmount = _amount;
    }

    function readyForSettlement() external pure returns (bool) {
        return true;
    }
}

contract FinalityEscrowTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private buyer = address(0xB0B);
    address private seller = address(0x5E11);
    address private source = address(0x50CE);
    bytes32 private job = keccak256("job-1");
    bytes32 private policy = keccak256("policy");
    bytes32 private evidence = keccak256("evidence");
    uint256 private sourceChainId = block.chainid;
    uint256 private amount = 1 ether;
    FinalityEscrow private receiptEscrow;

    function _newEscrow(address _seller) private returns (FinalityEscrow escrow) {
        vm.deal(buyer, amount);
        vm.prank(buyer);
        escrow = new FinalityEscrow{value: amount}(
            buyer, _seller, source, sourceChainId, block.chainid, job, policy, evidence
        );
        receiptEscrow = escrow;
    }

    function _receipt(FinalityEscrow.Outcome result, address boundSeller, address destination)
        private
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                _receiptPrefix(),
                boundSeller,
                policy,
                evidence,
                uint8(result),
                destination,
                bytes32("NATIVE_GEN"),
                amount
            )
        );
    }

    function _receiptPrefix() private view returns (bytes memory) {
        return abi.encodePacked(
            bytes32("EOD-RECEIPT-V3"), sourceChainId, block.chainid, source, address(receiptEscrow), job, buyer
        );
    }

    function _vectorReceipt(string memory vector, string memory caseName) private view returns (bytes32) {
        string memory casePrefix = string.concat(".cases.", caseName, ".");
        return keccak256(
            abi.encodePacked(
                _vectorPrefix(vector),
                vm.parseJsonAddress(vector, ".seller"),
                vm.parseJsonBytes32(vector, ".policy_commitment"),
                vm.parseJsonBytes32(vector, ".evidence_commitment"),
                uint8(vm.parseJsonUint(vector, string.concat(casePrefix, "outcome"))),
                vm.parseJsonAddress(vector, string.concat(casePrefix, "destination")),
                bytes32(bytes(vm.parseJsonString(vector, ".payment_asset"))),
                vm.parseJsonUint(vector, ".amount")
            )
        );
    }

    function _vectorPrefix(string memory vector) private pure returns (bytes memory) {
        return abi.encodePacked(
            bytes32(bytes(vm.parseJsonString(vector, ".version"))),
            vm.parseJsonUint(vector, ".source_chain_id"),
            vm.parseJsonUint(vector, ".settlement_chain_id"),
            vm.parseJsonAddress(vector, ".source_contract"),
            vm.parseJsonAddress(vector, ".escrow"),
            vm.parseJsonBytes32(vector, ".job_id"),
            vm.parseJsonAddress(vector, ".buyer")
        );
    }

    function testSharedReceiptVectorsMatchCanonicalEncoding() public view {
        string memory vector = vm.readFile("test/receipt-vectors.json");
        require(
            _vectorReceipt(vector, "accept") == vm.parseJsonBytes32(vector, ".cases.accept.receipt"),
            "accept vector mismatch"
        );
        require(
            _vectorReceipt(vector, "reject") == vm.parseJsonBytes32(vector, ".cases.reject.receipt"),
            "reject vector mismatch"
        );
        require(
            _vectorReceipt(vector, "undetermined") == vm.parseJsonBytes32(vector, ".cases.undetermined.receipt"),
            "undetermined vector mismatch"
        );
    }

    function testProductionReceiptUsesEscrowAndSettlementChain() public {
        FinalityEscrow escrow = _newEscrow(seller);
        bytes32 expected = escrow.expectedReceipt(FinalityEscrow.Outcome.ACCEPT, seller);
        require(expected == _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller), "production receipt mismatch");
        require(expected != escrow.expectedReceipt(FinalityEscrow.Outcome.ACCEPT, buyer), "destination omitted");
    }

    function testConstructorRejectsNonLocalSettlementChain() public {
        vm.deal(buyer, amount);
        vm.prank(buyer);
        vm.expectRevert(bytes("settlement chain mismatch"));
        new FinalityEscrow{value: amount}(
            buyer, seller, source, block.chainid, block.chainid + 1, job, policy, evidence
        );
    }

    function testFactoryDeploysOnlyBoundEscrowForActualBuyer() public {
        FinalityEscrowFactory factory = new FinalityEscrowFactory();
        vm.deal(buyer, amount);
        vm.prank(buyer);
        address escrowAddress =
            factory.deployEscrow{value: amount}(seller, source, sourceChainId, block.chainid, job, policy, evidence);
        FinalityEscrow escrow = FinalityEscrow(payable(escrowAddress));
        bytes32 key =
            factory.deploymentKey(buyer, seller, source, sourceChainId, block.chainid, job, policy, evidence, amount);

        require(factory.escrowForKey(key) == escrowAddress, "factory provenance missing");
        require(escrow.buyer() == buyer, "factory replaced buyer");
        require(escrow.seller() == seller, "wrong seller");
        require(escrow.authorizedSource() == source, "wrong source");
        require(escrow.readyForSettlement(), "factory escrow not ready");
    }

    function testFactoryCannotRegisterOrReplaceAnEscrow() public {
        FinalityEscrowFactory factory = new FinalityEscrowFactory();
        vm.deal(buyer, amount * 2);
        vm.prank(buyer);
        factory.deployEscrow{value: amount}(seller, source, sourceChainId, block.chainid, job, policy, evidence);

        vm.prank(buyer);
        vm.expectRevert(bytes("escrow already deployed"));
        factory.deployEscrow{value: amount}(seller, source, sourceChainId, block.chainid, job, policy, evidence);
    }

    function testFactoryProvenanceDoesNotResolveMatchingGetterLookalike() public {
        FinalityEscrowFactory factory = new FinalityEscrowFactory();
        vm.deal(buyer, amount);
        vm.prank(buyer);
        factory.deployEscrow{value: amount}(seller, source, sourceChainId, block.chainid, job, policy, evidence);
        GetterLookalike lookalike =
            new GetterLookalike(buyer, seller, source, sourceChainId, block.chainid, job, policy, evidence, amount);
        bytes32 key =
            factory.deploymentKey(buyer, seller, source, sourceChainId, block.chainid, job, policy, evidence, amount);

        require(factory.escrowForKey(key) != address(lookalike), "lookalike gained factory provenance");
        require(lookalike.readyForSettlement(), "lookalike getter is not matching");
    }

    function _settle(FinalityEscrow escrow, FinalityEscrow.Outcome result, address destination) private {
        _settleFor(escrow, result, seller, destination);
    }

    function _settleFor(FinalityEscrow escrow, FinalityEscrow.Outcome result, address boundSeller, address destination)
        private
    {
        vm.prank(source);
        escrow.settle(
            job,
            result,
            buyer,
            boundSeller,
            policy,
            evidence,
            sourceChainId,
            _receipt(result, boundSeller, destination),
            destination
        );
    }

    function testAcceptRecordsSellerClaimWithoutCallingRecipient() public {
        ToggleRecipient recipient = new ToggleRecipient();
        recipient.setRejectPayments(true);
        FinalityEscrow escrow = _newEscrow(address(recipient));
        recipient.setEscrow(escrow);

        _settleFor(escrow, FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient));

        require(escrow.settled(), "not settled");
        require(escrow.claimRecorded(), "claim not recorded");
        require(!escrow.paid(), "payment falsely completed");
        require(escrow.claimable(address(recipient)) == amount, "claim missing");
        require(recipient.receiveAttempts() == 0, "recipient called during settlement");
        require(address(escrow).balance == amount, "funds moved");
    }

    function testAcceptRecordsSellerClaim() public {
        FinalityEscrow escrow = _newEscrow(seller);

        _settle(escrow, FinalityEscrow.Outcome.ACCEPT, seller);

        require(escrow.settled(), "not settled");
        require(escrow.claimRecorded(), "claim not recorded");
        require(!escrow.paid(), "payment falsely completed");
        require(escrow.claimable(seller) == amount, "seller claim missing");
        require(seller.balance == 0, "seller paid during settlement");
        require(address(escrow).balance == amount, "funds moved");
    }

    function testRejectRecordsBuyerClaim() public {
        FinalityEscrow escrow = _newEscrow(seller);

        _settle(escrow, FinalityEscrow.Outcome.REJECT, buyer);

        require(escrow.settled(), "not settled");
        require(escrow.outcome() == FinalityEscrow.Outcome.REJECT, "wrong outcome");
        require(escrow.claimable(buyer) == amount, "buyer claim missing");
        require(!escrow.paid(), "refund falsely completed");
        require(address(escrow).balance == amount, "funds moved");
    }

    function testUndeterminedOutcomeCannotSettle() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.expectRevert(bytes("undetermined"));
        _settle(escrow, FinalityEscrow.Outcome.UNDETERMINED, buyer);

        require(!escrow.settled(), "settled undetermined");
        require(!escrow.claimRecorded(), "claim recorded for undetermined");
        require(address(escrow).balance == amount, "funds moved");
    }

    function testUndeterminedHasBoundNoPaymentReceipt() public {
        FinalityEscrow escrow = _newEscrow(seller);
        bytes32 receipt = escrow.expectedReceipt(FinalityEscrow.Outcome.UNDETERMINED, address(0));
        require(receipt != bytes32(0), "missing undetermined receipt");

        vm.prank(source);
        vm.expectRevert(bytes("undetermined"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.UNDETERMINED,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            receipt,
            address(0)
        );
        require(!escrow.settled(), "undetermined settled");
        require(escrow.claimable(buyer) == 0 && escrow.claimable(seller) == 0, "undetermined claim");
    }

    function testCallerCannotChooseReleaseOrRefund() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(buyer);
        (bool releaseOk,) = address(escrow).call(abi.encodeWithSignature("release()"));
        require(!releaseOk, "release path exists");

        vm.prank(buyer);
        (bool refundOk,) = address(escrow).call(abi.encodeWithSignature("refund()"));
        require(!refundOk, "refund path exists");
        require(!escrow.settled(), "caller settled escrow");
    }

    function testUnauthorizedSourceRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("unauthorized source"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongJobRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("job mismatch"));
        escrow.settle(
            keccak256("wrong job"),
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongBuyerRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("buyer mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            address(0xB0B1),
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongSellerRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("seller mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            address(0x5E12),
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, address(0x5E12), seller),
            seller
        );
    }

    function testWrongPolicyRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("policy mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            keccak256("wrong policy"),
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongEvidenceRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("evidence mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            keccak256("wrong evidence"),
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongDestinationRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("destination mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, buyer),
            buyer
        );
    }

    function testWrongSourceChainRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("source chain mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId + 1,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testWrongReceiptCommitmentRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);

        vm.prank(source);
        vm.expectRevert(bytes("receipt mismatch"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            keccak256("forged receipt"),
            seller
        );
    }

    function testReceiptCommitmentChangesWithBoundInputs() public view {
        bytes32 acceptReceipt = _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller);
        bytes32 rejectReceipt = _receipt(FinalityEscrow.Outcome.REJECT, seller, buyer);
        bytes32 otherDestination = _receipt(FinalityEscrow.Outcome.ACCEPT, seller, buyer);
        require(acceptReceipt != rejectReceipt, "outcome not bound");
        require(acceptReceipt != otherDestination, "destination not bound");
    }

    function testInvalidOutcomeRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);
        bytes memory data = abi.encodeWithSignature(
            "settle(bytes32,uint8,address,address,bytes32,bytes32,uint256,bytes32,address)",
            job,
            uint8(3),
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );

        vm.prank(source);
        (bool ok,) = address(escrow).call(data);
        require(!ok, "invalid outcome accepted");
        require(!escrow.settled(), "invalid outcome settled");
    }

    function testReplayRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);
        _settle(escrow, FinalityEscrow.Outcome.ACCEPT, seller);

        vm.prank(source);
        vm.expectRevert(bytes("replay"));
        escrow.settle(
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            seller,
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, seller, seller),
            seller
        );
    }

    function testGasBombRecipientCannotBreakSettlement() public {
        GasBombRecipient recipient = new GasBombRecipient();
        FinalityEscrow escrow = _newEscrow(address(recipient));
        bytes memory data = abi.encodeWithSelector(
            FinalityEscrow.settle.selector,
            job,
            FinalityEscrow.Outcome.ACCEPT,
            buyer,
            address(recipient),
            policy,
            evidence,
            sourceChainId,
            _receipt(FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient)),
            address(recipient)
        );

        vm.prank(source);
        (bool ok,) = address(escrow).call{gas: 500_000}(data);
        require(ok, "gas bomb reverted settlement");
        require(escrow.settled(), "not settled");
        require(escrow.claimable(address(recipient)) == amount, "claim missing");
        require(address(escrow).balance == amount, "funds moved");
    }

    function testGasExhaustingWithdrawalPreservesClaim() public {
        GasExhaustingRecipient recipient = new GasExhaustingRecipient();
        FinalityEscrow escrow = _newEscrow(address(recipient));
        _settleFor(escrow, FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient));

        bytes memory data = abi.encodeWithSelector(recipient.withdrawFrom.selector, escrow);
        (bool ok,) = address(recipient).call{gas: 500_000}(data);
        require(!ok, "gas-exhausting withdrawal succeeded");
        require(escrow.claimable(address(recipient)) == amount, "gas failure lost claim");
        require(!escrow.paid(), "gas failure marked paid");
        require(address(escrow).balance == amount, "gas failure lost funds");
    }

    function testRevertingWithdrawalPreservesClaimAndSuccessfulRecovery() public {
        ToggleRecipient recipient = new ToggleRecipient();
        FinalityEscrow escrow = _newEscrow(address(recipient));
        recipient.setEscrow(escrow);
        recipient.setRejectPayments(true);

        _settleFor(escrow, FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient));
        require(recipient.receiveAttempts() == 0, "recipient called during settlement");

        vm.expectRevert(bytes("payment failed"));
        recipient.withdrawFrom();
        require(escrow.claimable(address(recipient)) == amount, "failed withdrawal lost claim");
        require(!escrow.paid(), "failed withdrawal marked paid");
        require(address(escrow).balance == amount, "failed withdrawal lost funds");

        recipient.setRejectPayments(false);
        recipient.withdrawFrom();
        require(escrow.paid(), "successful withdrawal not recorded");
        require(escrow.claimable(address(recipient)) == 0, "claim remains after withdrawal");
        require(address(recipient).balance == amount, "recipient not paid");
        require(address(escrow).balance == 0, "funds remain after withdrawal");
    }

    function testUnauthorizedWithdrawalRejected() public {
        FinalityEscrow escrow = _newEscrow(seller);
        _settle(escrow, FinalityEscrow.Outcome.ACCEPT, seller);

        vm.prank(address(0xBAD));
        vm.expectRevert(bytes("nothing claimable"));
        escrow.withdraw();
        require(escrow.claimable(seller) == amount, "seller claim changed");
    }

    function testDoubleWithdrawalRejected() public {
        ToggleRecipient recipient = new ToggleRecipient();
        FinalityEscrow escrow = _newEscrow(address(recipient));
        recipient.setEscrow(escrow);
        _settleFor(escrow, FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient));

        recipient.withdrawFrom();
        vm.expectRevert(bytes("nothing claimable"));
        recipient.withdrawFrom();
        require(escrow.claimable(address(recipient)) == 0, "claim recreated");
    }

    function testWithdrawalReentrancyRejected() public {
        ToggleRecipient recipient = new ToggleRecipient();
        FinalityEscrow escrow = _newEscrow(address(recipient));
        recipient.setEscrow(escrow);
        recipient.setReenter(true);
        _settleFor(escrow, FinalityEscrow.Outcome.ACCEPT, address(recipient), address(recipient));

        recipient.withdrawFrom();
        require(recipient.receiveAttempts() == 1, "recipient not called once");
        require(!recipient.reentrySucceeded(), "reentrant withdrawal succeeded");
        require(escrow.paid(), "withdrawal not completed");
        require(escrow.claimable(address(recipient)) == 0, "claim remains");
        require(address(recipient).balance == amount, "recipient not paid");
    }
}
