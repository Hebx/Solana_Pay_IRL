import { useRouter } from "next/router";
import { useMemo, useEffect, useRef } from "react";
import BackLink from "../../components/BackLink";
import PageHeading from "../../components/PageHeading";
import calculatePrice from "../../lib/calculatePrice";
import { createQR, encodeURL, EncodeURLComponents, findTransactionSignature, FindTransactionSignatureError, validateTransactionSignature, ValidateTransactionSignatureError } from "@solana/pay";
import { clusterApiUrl, Connection, Keypair } from "@solana/web3.js";
import { shopAddress, usdcAddress } from "../../lib/addresses";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";


export default function Checkout() {
  const router = useRouter()

//   Ref to a Div of the QR Code
const qrRef = useRef<HTMLDivElement>(null);

  const amount = useMemo(() => calculatePrice(router.query), [router.query])

// Unique address that we can listen for payments to
	const reference = useMemo(() => Keypair.generate().publicKey, [])

	const network = WalletAdapterNetwork.Devnet;
	const endpoint = clusterApiUrl(network);
	const connection = new Connection(endpoint);

// Solana Pay transfer params
const urlParams: EncodeURLComponents = {
	recipient: shopAddress,
    splToken: usdcAddress,
    amount,
    reference,
    label: "Beers Inc",
    message: "Cheers! Enjoy Your Drink 🍺",
}

// Encode the Params into the format shown
const url = encodeURL(urlParams);
console.log({url});

// Show the QR Code
useEffect(() => {
	const qr = createQR(url, 512, 'transparent');
	if (qrRef.current && amount.isGreaterThan(0)) {
		qrRef.current.innerHTML = ''
		qr.append(qrRef.current);
	}
})

// check every 0.5 sec if the transaction is completed
useEffect(() => {
	const interval = setInterval( async () => {
		try {
			// check if there is any transaction for the reference
			const signatureInfo = await findTransactionSignature(connection, reference, {}, 'confirmed');
			// validate that the transaction has the expected recipient, and amount of SPL tokens
			await validateTransactionSignature(connection, signatureInfo.signature, shopAddress, amount, usdcAddress, reference, 'confirmed')
			router.push('/shop/confirmed')
		} catch (e) {
			if (e instanceof FindTransactionSignatureError) {
				return;
			}
			if (e instanceof ValidateTransactionSignatureError) {
				console.error('transaction is invalid', e)
				return
			}
			console.error('Unknown error', e)
		}
	}, 500)
	return () => {
		clearInterval(interval)
	}
}, [])

  return (
    <div className="flex flex-col gap-8 items-center">
      <BackLink href='/shop'>Cancel</BackLink>
      <PageHeading>Checkout ${amount.toString()}</PageHeading>
	  <div ref={qrRef} />
    </div>
  )
}
