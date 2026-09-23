// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice GenLayer-chain EVM escrow for the finalized acceptance receipt.
///
/// The authorized source is the address of the GenLayer Intelligent Contract
/// (and its GenLayer-chain ghost).  GenLayer's finalized external message
/// delivery makes that address msg.sender at this boundary.  There is no
/// operator, arbiter, release(), or refund() entry point.
contract FinalityEscrow {
    enum Outcome {
        ACCEPT,
        REJECT,
        UNDETERMINED
    }

    address public immutable buyer;
    address public immutable seller;
    address public immutable authorizedSource;
    uint256 public immutable sourceChainId;
    uint256 public immutable settlementChainId;
    bytes32 public immutable jobId;
    bytes32 public immutable policyCommitment;
    bytes32 public immutable evidenceCommitment;
    uint256 public immutable fundedAmount;

    bool public settled;
    bool public claimRecorded;
    bool public paid;
    Outcome public outcome;
    address public settlementDestination;
    bytes32 public receiptCommitment;
    mapping(address => uint256) public claimable;

    bytes32 public constant RECEIPT_VERSION = bytes32("EOD-RECEIPT-V3");
    bytes32 public constant PAYMENT_ASSET = bytes32("NATIVE_GEN");

    uint256 private _entered;

    event Funded(address indexed buyer, uint256 amount);
    event SettlementRecorded(
        bytes32 indexed jobId,
        Outcome outcome,
        address indexed destination,
        uint256 amount,
        bool claimRecorded,
        bool paymentCompleted
    );
    event PaymentClaimRecorded(address indexed recipient, uint256 amount);
    event PaymentClaimed(address indexed recipient, uint256 amount);

    modifier nonReentrant() {
        require(_entered == 0, "reentrant");
        _entered = 1;
        _;
        _entered = 0;
    }

    constructor(
        address _buyer,
        address _seller,
        address _authorizedSource,
        uint256 _sourceChainId,
        uint256 _settlementChainId,
        bytes32 _jobId,
        bytes32 _policyCommitment,
        bytes32 _evidenceCommitment
    ) payable {
        require(msg.value > 0, "fund me");
        require(_buyer != address(0), "zero buyer");
        require(_seller != address(0), "zero seller");
        require(_authorizedSource != address(0), "zero source");
        require(_sourceChainId != 0, "zero source chain");
        require(_settlementChainId == block.chainid, "settlement chain mismatch");
        require(_sourceChainId == _settlementChainId, "source chain mismatch");
        require(_jobId != bytes32(0), "zero job");
        require(_policyCommitment != bytes32(0), "zero policy");
        require(_evidenceCommitment != bytes32(0), "zero evidence");
        require(_buyer != _seller, "parties must differ");

        buyer = _buyer;
        seller = _seller;
        authorizedSource = _authorizedSource;
        sourceChainId = _sourceChainId;
        settlementChainId = _settlementChainId;
        jobId = _jobId;
        policyCommitment = _policyCommitment;
        evidenceCommitment = _evidenceCommitment;
        fundedAmount = msg.value;

        emit Funded(_buyer, msg.value);
    }

    /// @notice The only settlement path.  It is callable only by the bound
    /// GenLayer IC/ghost address and requires the complete receipt binding.
    function settle(
        bytes32 _jobId,
        Outcome _outcome,
        address _buyer,
        address _seller,
        bytes32 _policyCommitment,
        bytes32 _evidenceCommitment,
        uint256 _sourceChainId,
        bytes32 _receiptCommitment,
        address _destination
    ) external nonReentrant {
        require(msg.sender == authorizedSource, "unauthorized source");
        require(!settled, "replay");
        require(_jobId == jobId, "job mismatch");
        require(_buyer == buyer, "buyer mismatch");
        require(_seller == seller, "seller mismatch");
        require(_policyCommitment == policyCommitment, "policy mismatch");
        require(_evidenceCommitment == evidenceCommitment, "evidence mismatch");
        require(_sourceChainId == sourceChainId, "source chain mismatch");
        require(settlementChainId == block.chainid, "settlement chain mismatch");
        require(_outcome != Outcome.UNDETERMINED, "undetermined");

        address expectedDestination = _outcome == Outcome.ACCEPT ? seller : buyer;
        require(_destination == expectedDestination, "destination mismatch");
        require(address(this).balance >= fundedAmount, "underfunded");

        bytes32 expectedCommitment = _expectedReceipt(_outcome, expectedDestination);
        require(_receiptCommitment == expectedCommitment, "receipt mismatch");

        settled = true;
        outcome = _outcome;
        settlementDestination = expectedDestination;
        receiptCommitment = expectedCommitment;
        claimRecorded = true;
        claimable[expectedDestination] = fundedAmount;

        // Settlement records entitlement without invoking recipient code.  The
        // recipient controls when and how its own withdrawal call is retried.
        emit PaymentClaimRecorded(expectedDestination, fundedAmount);
        emit SettlementRecorded(jobId, _outcome, expectedDestination, fundedAmount, true, false);
    }

    /// @notice Returns the receipt the escrow will authenticate for a given
    /// outcome and destination. This is a production view over immutable
    /// escrow state, not a test-only receipt helper.
    function expectedReceipt(Outcome _outcome, address _destination) external view returns (bytes32) {
        return _expectedReceipt(_outcome, _destination);
    }

    /// @notice True only while this reviewed implementation still holds the
    /// constructor-funded amount and has not recorded a settlement. An IC can
    /// read this state, but typed EVM views alone cannot attest code identity.
    function readyForSettlement() external view returns (bool) {
        return
            !settled && !claimRecorded && !paid && receiptCommitment == bytes32(0)
                && address(this).balance >= fundedAmount;
    }

    function _expectedReceipt(Outcome _outcome, address _destination) private view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                _receiptPrefix(),
                seller,
                policyCommitment,
                evidenceCommitment,
                uint8(_outcome),
                _destination,
                PAYMENT_ASSET,
                fundedAmount
            )
        );
    }

    function _receiptPrefix() private view returns (bytes memory) {
        return abi.encodePacked(
            RECEIPT_VERSION, sourceChainId, settlementChainId, authorizedSource, address(this), jobId, buyer
        );
    }

    /// @notice Withdraw a previously recorded pull-payment claim.
    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, "nothing claimable");

        claimable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "payment failed");

        paid = true;
        emit PaymentClaimed(msg.sender, amount);
    }
}
