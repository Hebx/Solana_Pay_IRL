import { createTransferCheckedInstruction, getAssociatedTokenAddress, getMint } from "@solana/spl-token"
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  clusterApiUrl,
  Connection,
  PublicKey,
  Transaction,
} from '@solana/web3.js'
import { NextApiRequest, NextApiResponse } from 'next'
import { shopAddress, usdcAddress } from '../../lib/addresses'
import calculatePrice from '../../lib/calculatePrice'

export type MakeTransactionInputData = {
  account: string
}

export type MakeTransactionOutputData = {
  transaction: string
  message: string
}

type ErrorOutput = {
  error: string
}

export default async function handler(
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
    const buyerPublicKey = new PublicKey(account)
    const shopPublicKey = shopAddress
    const network = WalletAdapterNetwork.Devnet
    const endpoint = clusterApiUrl(network)
    const connection = new Connection(endpoint)

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
      amount.toNumber() * (10 ** (await usdcMint).decimals),
      usdcMint.decimals,
    )

    // add the ref to the instruction as a key
    // transaction is returned when we query for the ref
    transferInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    })

    // add the instruction to the transaction
    transaction.add(transferInstruction)

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
