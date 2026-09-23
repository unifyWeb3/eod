# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }
"""Stage-1 finality-to-settlement fixture.

The fixed outcome is deliberately isolated from the application evaluator.
``Acceptance`` computes the Stage-2 result; this harness only preserves a
small, local test surface for finalized-message encoding. It does not prove
GenLayer delivery or finality on its own.
"""

import genlayer as gl
from genlayer.types import Address, Keccak256, u8, u256
from genlayer.evm import bytes32


@gl.evm.contract_interface
class _FinalityEscrow:
    class View:
        pass

    class Write:
        def settle(
            self,
            job_id: bytes32,
            outcome: u8,
            buyer: Address,
            seller: Address,
            policy_commitment: bytes32,
            evidence_commitment: bytes32,
            source_chain_id: u256,
            receipt_commitment: bytes32,
            destination: Address,
            /,
        ) -> None: ...


class FinalitySettlement(gl.contract.Contract):
    """Emit a binding settlement message only on GenLayer finalization."""

    job_id: str
    buyer: Address
    seller: Address
    deployer: Address
    policy_commitment: str
    evidence_commitment: str
    escrow: Address
    planned_outcome: u8
    funded_amount: u256
    outcome: u8
    status: str
    receipt_commitment: str

    def __init__(
        self,
        job_id: str,
        buyer: Address,
        seller: Address,
        policy_commitment: str,
        evidence_commitment: str,
        escrow: Address,
        planned_outcome: u8,
        funded_amount: u256,
    ):
        # The installed direct-test adapter exposes fixture addresses as raw
        # bytes, while GenVM calldata supplies Address values.  Normalize at
        # the contract boundary so both paths exercise the same storage type.
        buyer = Address(buyer)
        seller = Address(seller)
        escrow = Address(escrow)
        self._require_hex32(job_id, "job id")
        self._require_hex32(policy_commitment, "policy commitment")
        self._require_hex32(evidence_commitment, "evidence commitment")
        if buyer == Address.ZERO or seller == Address.ZERO:
            raise gl.vm.UserError("[SCHEMA] zero party")
        if buyer == seller:
            raise gl.vm.UserError("[SCHEMA] parties must differ")
        if Address(gl.message.sender_address) != buyer:
            raise gl.vm.UserError("[SCHEMA] buyer must deploy")
        if planned_outcome > u8(2):
            raise gl.vm.UserError("[SCHEMA] invalid outcome")
        if funded_amount <= 0:
            raise gl.vm.UserError("[SCHEMA] funded amount required")

        self.job_id = job_id
        self.buyer = buyer
        self.seller = seller
        self.deployer = buyer
        self.policy_commitment = policy_commitment
        self.evidence_commitment = evidence_commitment
        self.escrow = escrow
        self.planned_outcome = planned_outcome
        self.funded_amount = funded_amount
        self.outcome = u8(2)
        self.status = "OPEN"
        self.receipt_commitment = ""

    @gl.public.write
    def bind_escrow(self, escrow: Address) -> None:
        """Bind the deployed EVM escrow once during setup.

        The source IC address is only known after its deployment.  The
        deployer may therefore fill the other half of the address binding once
        before any outcome is published.  This is setup authority, not a
        replaceable settlement authority.
        """
        if Address(gl.message.sender_address) != self.deployer:
            raise gl.vm.UserError("[AUTH] deployer only")
        if self.status != "OPEN":
            raise gl.vm.UserError("[STALE] outcome already published")
        if self.escrow != Address.ZERO:
            raise gl.vm.UserError("[BIND] escrow already bound")
        escrow = Address(escrow)
        if escrow == Address.ZERO:
            raise gl.vm.UserError("[SCHEMA] zero escrow")
        self.escrow = escrow

    def _require_hex32(self, value: str, label: str) -> None:
        raw = value[2:] if value.startswith("0x") else value
        if len(raw) != 64:
            raise gl.vm.UserError("[SCHEMA] " + label + " must be 32 bytes")
        for ch in raw:
            if not (
                ("0" <= ch and ch <= "9")
                or ("a" <= ch and ch <= "f")
                or ("A" <= ch and ch <= "F")
            ):
                raise gl.vm.UserError("[SCHEMA] " + label + " must be hex")

    def _as_bytes32(self, value: str) -> bytes32:
        raw = value[2:] if value.startswith("0x") else value
        return bytes32(bytes.fromhex(raw))

    def _receipt_commitment(self, outcome: u8, destination: Address) -> bytes32:
        hasher = Keccak256()
        hasher.update(b"EOD-RECEIPT-V3" + b"\x00" * 18)
        hasher.update(int(gl.message.chain_id).to_bytes(32, "big"))
        hasher.update(int(gl.message.chain_id).to_bytes(32, "big"))
        hasher.update(Address(gl.message.contract_address).as_bytes)
        hasher.update(self.escrow.as_bytes)
        hasher.update(self._as_bytes32(self.job_id))
        hasher.update(self.buyer.as_bytes)
        hasher.update(self.seller.as_bytes)
        hasher.update(self._as_bytes32(self.policy_commitment))
        hasher.update(self._as_bytes32(self.evidence_commitment))
        hasher.update(bytes([int(outcome)]))
        hasher.update(Address(destination).as_bytes)
        hasher.update(b"NATIVE_GEN" + b"\x00" * 22)
        hasher.update(int(self.funded_amount).to_bytes(32, "big"))
        return bytes32(hasher.digest())

    @gl.public.write
    def publish_outcome(self) -> None:
        """Emit the already-bound stage-1 evaluator result.

        The external EVM call has no accepted-stage variant in GenLayer's
        external message API.  ``emit()`` below is consequently a finalized
        message; it is not an operator or relayer callback.  The caller cannot
        supply or change the outcome at this boundary.
        """
        if self.status != "OPEN":
            raise gl.vm.UserError("[STALE] outcome already published")
        if self.escrow == Address.ZERO:
            raise gl.vm.UserError("[BIND] escrow not bound")

        outcome = self.planned_outcome
        self.outcome = outcome
        destination = self.seller if outcome == u8(0) else self.buyer if outcome == u8(1) else Address.ZERO
        receipt = self._receipt_commitment(outcome, destination)
        self.receipt_commitment = "0x" + receipt.hex()
        if outcome == u8(2):
            self.status = "UNDETERMINED"
            return

        self.status = "ACCEPT" if outcome == u8(0) else "REJECT"

        # External messages are protocol-scheduled for finalization by the
        # GenLayer runtime.  The EVM recipient authenticates this IC address
        # through msg.sender and validates every binding in the payload.
        _FinalityEscrow(self.escrow).emit().settle(
            self._as_bytes32(self.job_id),
            outcome,
            self.buyer,
            self.seller,
            self._as_bytes32(self.policy_commitment),
            self._as_bytes32(self.evidence_commitment),
            gl.message.chain_id,
            receipt,
            destination,
        )

    @gl.public.view
    def get_status(self) -> str:
        return self.status

    @gl.public.view
    def get_outcome(self) -> u8:
        return self.outcome

    @gl.public.view
    def get_escrow(self) -> Address:
        return self.escrow

    @gl.public.view
    def get_receipt_commitment(self) -> str:
        return self.receipt_commitment
