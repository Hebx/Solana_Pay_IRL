import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Keypair, Transaction } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import BackLink from "../components/BackLink";
import Loading from "../components/Loading";
import { MakeTransactionInputData, MakeTransactionOutputData } from "./api/makeTransaction";
import { useConnection } from "@solana/wallet-adapter-react";
import { findTransactionSignature, FindTransactionSignatureError } from "@solana/pay";


export default function Checkout() {
  const router = useRouter()
  const {publicKey, sendTransaction} = useWallet();
  const {connection} = useConnection();

  // state to hold the API response fields
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // read the URL query which includes our chosen products
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(router.query)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, v);
        }
      } else {
        searchParams.append(key, value);
      }
    }
  }

  // generate the unique reference which will be used for this transaction
  const reference = useMemo(() => Keypair.generate().publicKey, []);

  // Add it to the params we will pass to the API
  searchParams.append('reference', reference.toString());

  // use our API to fetch the transaction for the selected items
  async function getTransaction() {
    if (!publicKey) {
      return;
    }

    const body: MakeTransactionInputData = {
      account: publicKey.toString(),
    }

    const response = await fetch(`/api/makeTransaction?${searchParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    })

    const json = await response.json() as MakeTransactionOutputData;

    if (response.status !== 200) {
      console.error(json);
      return;
    }

    // Deserialize the transaction from the response
    const transaction = Transaction.from(Buffer.from(json.transaction, 'base64'));
    setTransaction(transaction);
    setMessage(json.message);
    console.log(transaction);
  }

  useEffect(() => {
    getTransaction();
  }, [publicKey])

  // send the fetched transaction to the connected wallet
  async function trySendTransaction() {
    if (!transaction) {
      return;
    }
    try {
      await sendTransaction(transaction, connection);
    } catch (e) {
      console.error(e)
    }
  }

  // send the transaction once it's fetched
  useEffect(() => {
    trySendTransaction();
  }, [transaction])

// Check every 5 sec if the transaction is finished
  useEffect(() => {
    const interval = setInterval(async () => {
    try {
   // check if there is any transaction for the reference
    const signatureInfo = await findTransactionSignature(connection, reference, {});
    router.push('/confirmed')
    } catch (e) {
      if (e instanceof FindTransactionSignatureError) {
        // No Transaction found yet
        return;
      }
      console.error('Unknown error', e)
    }
  }, 500)
  return () => {
    clearInterval(interval);
  }
  }, [])


  // RENDER
  if (!publicKey) {
    return (
      <div className='flex flex-col gap-8 items-center'>
      <div><BackLink href='/'>Cancel</BackLink></div>

      <WalletMultiButton />

      <p>You need to connect your wallet to make transactions</p>
    </div>
    )
  }

  return (
    <div className='flex flex-col gap-8 items-center'>
      <div><BackLink href='/'>Cancel</BackLink></div>

      <WalletMultiButton />

      {message ?
        <p>{message} Please approve the transaction using your wallet</p> :
        <p>Creating transaction... <Loading /></p>
      }
    </div>
  )
}
