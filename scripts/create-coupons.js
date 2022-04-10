import { createAssociatedTokenAccount, createMint, getAccount, mintToChecked } from '@solana/spl-token'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { clusterApiUrl, Connection, Keypair } from '@solana/web3.js'
import base58 from 'bs58'

import 'dotenv/config'

// Initialise Solana connection
const network = WalletAdapterNetwork.Devnet
const endpoint = clusterApiUrl(network)
const connection = new Connection(endpoint)

// Initialize shop account
const shopPrivateKey = process.env.SHOP_PRIVATE_KEY
if (!shopPrivateKey) {
	throw new Error('SHOP_PRIVATE_KEY not set')
}
const shopAccount = Keypair.fromSecretKey(base58.decode(shopPrivateKey))

// create the token returns the token public key
console.log("Creating token..")
const myCouponAddress = await createMint(
	connection,
	shopAccount, //buyer
	shopAccount.publicKey, //mint
	shopAccount.publicKey, //freeze
	0 // decimals
)
console.log("Token created:", myCouponAddress.toString())

// create the associated token account for the shop

const shopCouponAddress = await createAssociatedTokenAccount(
	connection,
	shopAccount, //payer
	myCouponAddress, //token
	shopAccount.publicKey, // who to create account for

)
console.log("Token account created", shopCouponAddress.toString())

// Mint 1million coupons to the shop account
console.log("Minting 1 million coupons to the shop account..")
await mintToChecked(
	connection,
	shopAccount, //payer
	myCouponAddress, //token
	shopCouponAddress, //recipient
	shopAccount, // authority to mint
	1_000_000, // amount
	0, //decimals
)
console.log("Minted 1 million coupons to the shop account")

const { amount } = await getAccount(connection, shopCouponAddress)
console.log({
	myCouponAddress: myCouponAddress.toString(),
	balance: amount.toLocaleString(),
})
