// lib/createWallet.ts
import { randomBytes } from "crypto";
import bs58 from "bs58";
import BIP32Factory from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { Wallet as ERC20Wallet } from "ethers";
import { Keypair as SOLWallet } from "@solana/web3.js";
import { mnemonicGenerate, mnemonicToMiniSecret } from "@polkadot/util-crypto";
import { Keyring } from "@polkadot/keyring";
import { AptosAccount } from "aptos";
import StellarSdk from "stellar-sdk";
import { TronWeb } from "tronweb";
import TonWeb from "tonweb";
export default async function createWallet({ name = "", colorScheme = "zinc", }) {
    const erc20Keypair = ERC20Wallet.createRandom();
    const solanaKeypair = SOLWallet.generate();
    const bip32 = BIP32Factory(ecc);
    const network = bitcoin.networks.bitcoin;
    const seed = randomBytes(32);
    const root = bip32.fromSeed(seed, network);
    const path = "m/84'/0'/0'/0/0";
    const child = root.derivePath(path);
    const { address: btcAddress } = bitcoin.payments.p2wpkh({
        pubkey: Buffer.from(child.publicKey),
        network,
    });
    const btcPrivateKey = child.toWIF();
    const polkadotMnemonic = mnemonicGenerate();
    const polkadotSeed = mnemonicToMiniSecret(polkadotMnemonic);
    const keyring = new Keyring({ type: "sr25519" });
    const polkadotKeypair = keyring.addFromSeed(polkadotSeed);
    const stellarKeypair = StellarSdk.Keypair.random();
    const aptosAccount = new AptosAccount();
    const tronWeb = new TronWeb({
        fullHost: "https://api.trongrid.io",
    });
    const tronAccount = await tronWeb.createAccount();
    const tonweb = new TonWeb();
    const tonKeypair = tonweb.utils.keyPairFromSeed(randomBytes(32));
    const newWallet = {
        name: name || "",
        colorScheme: colorScheme || "zinc",
        balances: [],
        keypairs: [
            {
                type: "secp256k1",
                network: "erc20",
                public: erc20Keypair.address,
                private: erc20Keypair.privateKey,
            },
            {
                type: "ed25519",
                network: "solana",
                public: solanaKeypair.publicKey.toBase58(),
                private: bs58.encode(solanaKeypair.secretKey),
            },
            {
                type: "bech32",
                network: "bitcoin",
                public: btcAddress,
                private: btcPrivateKey,
            },
            {
                type: "sr25519",
                network: "polkadot",
                public: polkadotKeypair.address,
                private: polkadotMnemonic,
            },
            {
                type: "ed25519",
                network: "stellar",
                public: stellarKeypair.publicKey(),
                private: stellarKeypair.secret(),
            },
            {
                type: "ed25519",
                network: "aptos",
                public: aptosAccount.address().hex(),
                private: Buffer.from(aptosAccount.signingKey.secretKey).toString("hex"),
            },
            {
                type: "secp256k1",
                network: "tron",
                public: tronAccount.address.base58,
                private: tronAccount.privateKey,
            },
            {
                type: "ed25519",
                network: "toncoin",
                public: Buffer.from(tonKeypair.publicKey).toString("hex"),
                private: Buffer.from(tonKeypair.secretKey).toString("hex"),
            },
        ],
    };
    return newWallet;
}
