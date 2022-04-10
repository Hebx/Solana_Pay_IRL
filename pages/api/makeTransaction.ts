import { Keypair } from '@solana/web3.js';
import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint, getOrCreateAssociatedTokenAccount } from "@solana/spl-token"
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import { NextApiRequest, NextApiResponse } from 'next'
import { couponAddress, shopAddress, usdcAddress } from '../../lib/addresses'
import calculatePrice from '../../lib/calculatePrice'
import base58 from 'bs58';

export type MakeTransactionInputData = {
  account: string
}

type MakeTransactionGetResponse = {
  label: string,
  icon: string,
}

export type MakeTransactionOutputData = {
  transaction: string
  message: string
}

type ErrorOutput = {
  error: string
}

function get(res: NextApiResponse<MakeTransactionGetResponse>)
{
  res.status(200).json({
    label: "Beers Inc",
    icon: "https://freesvg.org/img/beer1.png"
  })
}
async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
  try {
    // we pass the selected item in the query calculate the expected  cost
    const amount = calculatePrice(req.query)
    if (amount.toNumber() === 0) {
      res.status(400).json({ error: `Can't checkout with charge of 0` })
      return
    }
    // we pass the reference to use in the query
    const { reference } = req.query
    if (!reference) {
      res.status(400).json({ error: `Missing reference` })
      return
    }
    // we pass the buyer's public key in JSON body
    const { account } = req.body as MakeTransactionInputData
    if (!account) {
      res.status(400).json({ error: `Missing account` })
      return
    }

    // we get the shop private key from .env
    const shopPrivateKey = process.env.SHOP_PRIVATE_KEY as string
    if (!shopPrivateKey) {
      res.status(500).json({ error: "Shop private key not available" })
    }
    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey))

    const buyerPublicKey = new PublicKey(account)
    const shopPublicKey = shopAddress
    const network = WalletAdapterNetwork.Devnet
    const endpoint = clusterApiUrl(network)
    const connection = new Connection(endpoint)

    // Get the buyer and seller coupon token accounts
    // Buyer one may not exist, so we create it as the shop account
    const buyerCouponAddress = await getOrCreateAssociatedTokenAccount(
      connection,
      shopKeypair, // shop pays the fee to create it
      couponAddress, // which token the account is for
      buyerPublicKey, //owner of the buyer token
    ).then(account => account.address)

    const shopCouponAddress = await getAssociatedTokenAddress(couponAddress, shopPublicKey)


    // Metadata Details about USDC token
    const usdcMint = await getMint(connection ,usdcAddress);
    // Buyer USDC token account address
    const buyerUsdcAddress = await getAssociatedTokenAddress(usdcAddress, buyerPublicKey);
    // Shop USDC token account address
    const shopUsdcAddress = await getAssociatedTokenAddress(usdcAddress, shopPublicKey);

    // get a recent blockhash to include in the transaction
    const { blockhash } = await connection.getLatestBlockhash('finalized')

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      // the buyer pays the transaction fee
      feePayer: buyerPublicKey,
    })

    // create the instruction to send USDC from the buyer to the shop
    const transferInstruction = createTransferCheckedInstruction(
      buyerUsdcAddress,
      usdcAddress,
      shopUsdcAddress,
      buyerPublicKey,
      amount.toNumber() * (10 ** usdcMint.decimals),
      usdcMint.decimals,
    )

    // add the ref to the instruction as a key
    // transaction is returned when we query for the ref
    transferInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    })

 // Create the instruction to send the coupon from the shop to the buyer
const couponInstruction = createTransferCheckedInstruction(
  shopCouponAddress, // source account (coupon)
  couponAddress, // token address (coupon)
  buyerCouponAddress, // destination account (coupon)
  shopPublicKey, // owner of source account
  1, // amount to transfer
  0, // decimals of the token
)

// Add both instructions to the transaction
transaction.add(transferInstruction, couponInstruction)

    // Sign the transaction as the shop, which is required to transfer the coupon
    // We must partial sign because the transfer instruction still requires the user
    transaction.partialSign(shopKeypair)

    // serialize the transaction and convert to base64 to return it
    const serializedTransaction = transaction.serialize({
      // buyer sign the transaction after it's returned to them
      requireAllSignatures: false,
    })
    const base64 = serializedTransaction.toString('base64')

    // insert into a database: info and amount
    //  return the serialized transaction
    res.status(200).json({
      transaction: base64,
      message: 'Thanks for your order 🔥',
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: `error creating the transaction` })
    return
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput>
) {
  if (req.method == "GET") {
    return get(res)
  } else if (req.method === "POST") {
    return await post(req, res)
  } else {
    return res.status(405).json({error: "Method Not Allowed"})
  }
}
