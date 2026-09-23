"""Direct-mode tests for the stage-1 message boundary.

These tests mock GenVM's external-message sink.  They verify the source
contract's encoded binding and finalized-message shape; they do not prove
GenLayer consensus or finality.  The EVM tests separately cover the recipient
contract's enforcement under a mocked authorized source address.
"""

from eth_abi import decode
from eth_utils import keccak


JOB = "11" * 32
POLICY = "22" * 32
EVIDENCE = "33" * 32
ESCROW = "0x" + "44" * 20
ZERO_ADDRESS = "0x" + "00" * 20
AMOUNT = 1_000_000_000_000_000_000
SETTLE_SELECTOR = keccak(
    text="settle(bytes32,uint8,address,address,bytes32,bytes32,uint256,bytes32,address)"
)[:4]


def deploy_source(direct_vm, direct_deploy, buyer, seller, outcome):
    with direct_vm.prank(buyer):
        return direct_deploy(
            "contracts/finality_settlement.py",
            JOB,
            buyer,
            seller,
            POLICY,
            EVIDENCE,
            ESCROW,
            outcome,
            AMOUNT,
        )


def capture_messages(direct_vm):
    messages = []

    def hook(_vm, request):
        if "EmitExternalMessage" in request:
            messages.append(request["EmitExternalMessage"])
        return {"ok": None}

    direct_vm._gl_call_hook = hook
    return messages


def address_hex(value):
    if hasattr(value, "as_hex"):
        return value.as_hex
    return "0x" + bytes(value).hex()


def test_accept_emits_bound_external_message(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_source(direct_vm, direct_deploy, direct_alice, direct_bob, 0)
    messages = capture_messages(direct_vm)

    contract.publish_outcome()

    assert contract.get_status() == "ACCEPT"
    assert contract.get_outcome() == 0
    assert len(messages) == 1
    message = messages[0]
    assert message["address"].as_hex.lower() == ESCROW.lower()
    assert "on" not in message
    assert message["calldata"][:4] == SETTLE_SELECTOR

    decoded = decode(
        [
            "bytes32",
            "uint8",
            "address",
            "address",
            "bytes32",
            "bytes32",
            "uint256",
            "bytes32",
            "address",
        ],
        message["calldata"][4:],
    )
    assert decoded[0] == bytes.fromhex(JOB)
    assert decoded[1] == 0
    assert decoded[2].lower() == address_hex(direct_alice).lower()
    assert decoded[3].lower() == address_hex(direct_bob).lower()
    assert decoded[4] == bytes.fromhex(POLICY)
    assert decoded[5] == bytes.fromhex(EVIDENCE)
    assert decoded[6] > 0
    assert decoded[7] != bytes(32)
    assert decoded[8].lower() == address_hex(direct_bob).lower()


def test_reject_binds_destination_to_buyer(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_source(direct_vm, direct_deploy, direct_alice, direct_bob, 1)
    messages = capture_messages(direct_vm)

    contract.publish_outcome()

    assert contract.get_status() == "REJECT"
    assert len(messages) == 1
    decoded = decode(
        [
            "bytes32",
            "uint8",
            "address",
            "address",
            "bytes32",
            "bytes32",
            "uint256",
            "bytes32",
            "address",
        ],
        messages[0]["calldata"][4:],
    )
    assert decoded[1] == 1
    assert decoded[8].lower() == address_hex(direct_alice).lower()


def test_undetermined_emits_no_settlement_message(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_source(direct_vm, direct_deploy, direct_alice, direct_bob, 2)
    messages = capture_messages(direct_vm)

    contract.publish_outcome()

    assert contract.get_status() == "UNDETERMINED"
    assert contract.get_outcome() == 2
    assert messages == []
    assert contract.get_receipt_commitment().startswith("0x")


def test_outcome_replay_is_rejected(direct_vm, direct_deploy, direct_alice, direct_bob):
    contract = deploy_source(direct_vm, direct_deploy, direct_alice, direct_bob, 0)
    capture_messages(direct_vm)
    contract.publish_outcome()

    with direct_vm.expect_revert("[STALE]"):
        contract.publish_outcome()


def test_escrow_binding_is_deployer_only_and_one_time(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    with direct_vm.prank(direct_alice):
        contract = direct_deploy(
            "contracts/finality_settlement.py",
            JOB,
            direct_alice,
            direct_bob,
            POLICY,
            EVIDENCE,
            ZERO_ADDRESS,
            0,
            AMOUNT,
        )

    with direct_vm.expect_revert("[BIND]"):
        contract.publish_outcome()

    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("[AUTH]"):
            contract.bind_escrow(ESCROW)

    with direct_vm.prank(direct_alice):
        contract.bind_escrow(ESCROW)

    with direct_vm.prank(direct_alice):
        with direct_vm.expect_revert("[BIND]"):
            contract.bind_escrow("0x" + "55" * 20)


def test_source_deployment_requires_buyer_identity(direct_vm, direct_deploy, direct_alice, direct_bob):
    with direct_vm.prank(direct_bob):
        with direct_vm.expect_revert("[SCHEMA] buyer must deploy"):
            direct_deploy(
                "contracts/finality_settlement.py",
                JOB,
                direct_alice,
                direct_bob,
                POLICY,
                EVIDENCE,
                ZERO_ADDRESS,
                0,
                AMOUNT,
            )
