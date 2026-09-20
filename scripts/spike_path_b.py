"""Day-1 spike path (b): Base Sepolia escrow + studio-dev GenLayer verdict.

Real test funds move on Base Sepolia; GenLayer (studio-dev RC stack)
produces a finalized ACCEPT/REJECT/UNDETERMINED receipt; the arbiter
relays release()/refund() ONLY on FINALIZED + FINISHED_WITH_RETURN.

Resumable via scripts/spike_state_b.json (txids/public addrs only).
Logs redact addresses as 0x****...last4. Keys never printed.

seller = fixed UNOWNED test counterparty 0x1111...1111; receipt is
proven by onchain balances, no seller key exists or is needed.
"""

import json
import os
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gl_patch

gl_patch.apply()

BASE_CHAIN = 84532
GL_CHAIN = 61997
ALLOWED = {61997, 61999, 4221, 84532, 61127}
MAINNETS = {1, 8453, 10, 137, 42161}
STATE_PATH = os.path.join(os.path.dirname(__file__), "spike_state_b.json")
BASE_EXPLORER = "https://sepolia.basescan.org"
GL_EXPLORER = "https://explorer-studio-dev.genlayer.com"
SELLER = "0x1111111111111111111111111111111111111111"
FUND_WEI = 10_000_000_000_000_000  # 0.01 ETH
SPEC = "The deliverable must state that the sky is blue and include the number 42."
FIXTURE = "The sky is blue. Reference number: 42."


def load_env(path):
    d = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def redact(a):
    s = str(a)
    return "0x****..." + s[-4:] if s.lower().startswith("0x") else "****..." + s[-4:]


def log(*a):
    print(*a, flush=True)


def erpc(url, method, params=(), tries=8):
    body = json.dumps(
        {"jsonrpc": "2.0", "method": method, "params": list(params), "id": 1}
    ).encode()
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(
                url, data=body,
                headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"},
                method="POST",
            )
            return json.loads(urllib.request.urlopen(req, timeout=30).read().decode())
        except Exception as e:
            last = e
            time.sleep(5)
    raise last


def guard(url, expect, label):
    cid = int(erpc(url, "eth_chainId")["result"], 16)
    if cid in MAINNETS or cid not in ALLOWED:
        log(f"ABORT {label}: chain {cid} not testnet-allowed")
        sys.exit(3)
    if cid != expect:
        log(f"ABORT {label}: need {expect}, got {cid}")
        sys.exit(3)
    log(f"{label}: chain {cid} OK")
    return cid


def load_state():
    try:
        with open(STATE_PATH) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(s):
    with open(STATE_PATH, "w") as f:
        json.dump(s, f, indent=2)


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    env = load_env(os.path.join(root, ".env"))
    base_url = env.get("BASE_SEPOLIA_RPC_URL", "")
    base_priv = env.get("BASE_SEPOLIA_PRIVATE_KEY", "")
    base_me = env.get("BASE_SEPOLIA_ADDRESS", "")
    gl_url = env.get("GENLAYER_STUDIO_DEV_RPC", "")
    gl_priv = env.get("GENLAYER_PRIVATE_KEY", "")
    gl_me = env.get("GENLAYER_ADDRESS", "")
    for name, v in (("BASE_SEPOLIA_RPC_URL", base_url),
                    ("BASE_SEPOLIA_PRIVATE_KEY", base_priv),
                    ("BASE_SEPOLIA_ADDRESS", base_me),
                    ("GENLAYER_STUDIO_DEV_RPC", gl_url),
                    ("GENLAYER_PRIVATE_KEY", gl_priv),
                    ("GENLAYER_ADDRESS", gl_me)):
        if not v:
            log(f"FATAL missing {name}")
            return 2

    guard(base_url, BASE_CHAIN, "base-sepolia")
    guard(gl_url, GL_CHAIN, "studio-dev")

    from web3 import Web3
    from eth_account import Account as EthAccount

    w3 = Web3(Web3.HTTPProvider(base_url, request_kwargs={"timeout": 30}))
    acct = EthAccount.from_key(base_priv)
    if acct.address.lower() != base_me.lower():
        log("ABORT base key/address mismatch")
        return 3
    log(f"base operator {redact(base_me)} key-match OK")

    with open(os.path.join(root, "evm", "out", "SpikeEscrow.sol", "SpikeEscrow.json")) as f:
        art = json.load(f)
    escrow_factory = w3.eth.contract(abi=art["abi"], bytecode=art["bytecode"]["object"])
    state = load_state()

    def send_legacy(tx):
        tx["chainId"] = BASE_CHAIN
        tx["nonce"] = w3.eth.get_transaction_count(acct.address)
        gas = w3.eth.estimate_gas(tx)
        tx["gas"] = int(gas * 1.2)
        try:
            prio = w3.eth.max_priority_fee
        except Exception:
            prio = Web3.to_wei(1, "gwei")
        tx["maxPriorityFeePerGas"] = prio
        tx["maxFeePerGas"] = w3.eth.gas_price * 2
        signed = acct.sign_transaction(tx)
        h = w3.eth.send_raw_transaction(signed.raw_transaction)
        return h.hex()

    def bal(addr):
        return w3.eth.get_balance(addr)

    # ---- Phase 1: deploy + fund escrow (real ETH moves buyer -> escrow) ----
    eoa_b0 = bal(base_me)
    if "base_deploy_tx" not in state:
        log(f"deploying escrow seller={redact(SELLER)} value={FUND_WEI / 1e18} ETH...")
        tx = escrow_factory.constructor(SELLER, acct.address).build_transaction(
            {"from": acct.address, "value": FUND_WEI})
        h = send_legacy(tx)
        state["base_deploy_tx"] = h
        save_state(state)
        log(f"escrow deploy tx {h} ({BASE_EXPLORER}/tx/{h})")
    rcpt = w3.eth.wait_for_transaction_receipt(state["base_deploy_tx"], timeout=600)
    escrow_addr = rcpt["contractAddress"]
    state["escrow"] = escrow_addr
    save_state(state)
    log(f"escrow {redact(escrow_addr)} status={rcpt['status']} gasUsed={rcpt['gasUsed']}")
    if rcpt["status"] != 1:
        log("ABORT escrow deploy failed onchain")
        return 4
    esc = w3.eth.contract(address=escrow_addr, abi=art["abi"])
    for _ in range(60):
        if len(w3.eth.get_code(escrow_addr)) > 2 and bal(escrow_addr) == FUND_WEI:
            break
        time.sleep(5)
    log(f"escrow balance: {bal(escrow_addr) / 1e18:.6f} ETH (expect {FUND_WEI / 1e18})")
    log(f"as buyer={redact(esc.functions.buyer().call())} "
        f"seller={redact(esc.functions.seller().call())} "
        f"arbiter={redact(esc.functions.arbiter().call())}")

    # ---- Phase 2: GenLayer verdict on studio-dev ----
    from genlayer_py import create_client, create_account
    from genlayer_py.chains import studio_devnet
    from genlayer_py.transactions import is_successful

    gacct = create_account(gl_priv)
    if gacct.address.lower() != gl_me.lower():
        log("ABORT genlayer key/address mismatch")
        return 3
    client = create_client(chain=studio_devnet, endpoint=gl_url, account=gacct)

    if "gl_deploy_tx" not in state:
        with open(os.path.join(root, "contracts", "spike_verdict.py")) as f:
            code = f.read()
        fees = client.estimate_transaction_fees()
        t0 = time.time()
        txh = client.deploy_contract(
            code=code, args=[SPEC, FUND_WEI, escrow_addr],
            account=gacct, fees=fees)
        state["gl_deploy_tx"] = str(txh)
        save_state(state)
        log(f"verdict deploy tx {state['gl_deploy_tx']}")
    log("waiting verdict-deploy FINALIZED...")
    t0 = time.time()
    dtx = client.wait_for_finalization(state["gl_deploy_tx"], interval=10, retries=300)
    dt_dep = time.time() - t0
    log(f"deploy finalized {dt_dep:.0f}s successful={is_successful(dtx)}")
    gcontract = None
    if isinstance(dtx, dict):
        gcontract = dtx.get("recipient") or dtx.get("contractAddress")
    else:
        for attr in ("recipient", "contract_address", "address", "contractAddress"):
            gcontract = getattr(dtx, attr, None)
            if gcontract:
                break
    if not gcontract:
        log(f"ABORT cannot determine contract addr; tx keys/attrs inspected, none matched")
        return 4
    gcontract = str(gcontract)
    state["gl_contract"] = gcontract
    save_state(state)
    log(f"verdict contract {redact(gcontract)} ({GL_EXPLORER})")

    if "eval_tx" not in state:
        # Simulation-based estimate cannot run nondet LLM blocks; use an
        # explicit LLM-sized preset (cf. fee-profile doc profiling preset).
        fees = client.estimate_transaction_fees({
            "leaderTimeunitsAllocation": 100,
            "validatorTimeunitsAllocation": 200,
            "totalMessageFees": 0,
            "appealRounds": 0,
            "rotations": [1],
        })
        t0 = time.time()
        txh = client.write_contract(
            gcontract, "evaluate", account=gacct, args=[FIXTURE], fees=fees)
        state["eval_tx"] = str(txh)
        save_state(state)
        log(f"evaluate tx {state['eval_tx']}")
    log("waiting evaluate FINALIZED...")
    t0 = time.time()
    etx = client.wait_for_finalization(state["eval_tx"], interval=10, retries=300)
    dt_eval = time.time() - t0
    ok = is_successful(etx)
    log(f"evaluate finalized {dt_eval:.0f}s successful={ok}")
    if not ok:
        log("ABORT evaluate not successful")
        return 5
    verdict = client.read_contract(gcontract, "get_status", account=gacct)
    rationale = client.read_contract(gcontract, "get_rationale", account=gacct)
    state["verdict"] = str(verdict)
    save_state(state)
    log(f"VERDICT={verdict} rationale={rationale}")

    # ---- Phase 3: settle on real funds, gated on FINALIZED receipt ----
    seller_b0 = bal(SELLER)
    if esc.functions.released().call() or esc.functions.refunded().call():
        log("ABORT escrow already settled onchain; refusing resubmit")
        return 7
    if verdict == "ACCEPT":
        if "settle_tx" not in state:
            log("verdict ACCEPT -> release()...")
            h = send_legacy(esc.functions.release().build_transaction(
                {"from": acct.address}))
            state["settle_tx"] = h
            state["settle_kind"] = "release"
            save_state(state)
        rc = w3.eth.wait_for_transaction_receipt(state["settle_tx"], timeout=600)
        log(f"release tx {state['settle_tx']} status={rc['status']} gasUsed={rc['gasUsed']}")
    elif verdict == "REJECT":
        if "settle_tx" not in state:
            log("verdict REJECT -> refund()...")
            h = send_legacy(esc.functions.refund().build_transaction(
                {"from": acct.address}))
            state["settle_tx"] = h
            state["settle_kind"] = "refund"
            save_state(state)
        rc = w3.eth.wait_for_transaction_receipt(state["settle_tx"], timeout=600)
        log(f"refund tx {state['settle_tx']} status={rc['status']} gasUsed={rc['gasUsed']}")
    else:
        log("UNDETERMINED -> funds stay locked, no settlement. Honest halt.")
        return 0

    eoa_b1 = bal(base_me)
    seller_b1 = bal(SELLER)
    log("==== EVIDENCE ====")
    log(f"escrow: {escrow_addr} ({BASE_EXPLORER}/address/{escrow_addr})")
    log(f"base deploy: {state['base_deploy_tx']}")
    log(f"gl contract: {gcontract}  deploy: {state['gl_deploy_tx']}  eval: {state['eval_tx']}")
    log(f"settle ({state['settle_kind']}): {state['settle_tx']}")
    log(f"operator EOA: {eoa_b0 / 1e18:.6f} -> {eoa_b1 / 1e18:.6f} ETH")
    log(f"seller {redact(SELLER)}: {seller_b0 / 1e18:.6f} -> {seller_b1 / 1e18:.6f} ETH "
        f"(delta {(seller_b1 - seller_b0) / 1e18:+.6f})")
    log(f"escrow now: {bal(escrow_addr) / 1e18:.6f} ETH; "
        f"released={esc.functions.released().call()} refunded={esc.functions.refunded().call()}")
    log("DONE spike path (b)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
