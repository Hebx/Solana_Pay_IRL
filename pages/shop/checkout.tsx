import { useRouter } from "next/router";
import { useMemo, useEffect, useRef } from "react";
import BackLink from "../../components/BackLink";
import PageHeading from "../../components/PageHeading";
import calculatePrice from "../../lib/calculatePrice";
import { createQR, encodeURL, EncodeURLComponents } from "@solana/pay";
import { Keypair } from "@solana/web3.js";
import { shopAddress, usdcAddress } from "../../lib/addresses";


export default function Checkout() {
  const router = useRouter()

//   Ref to a Div of the QR Code
const qrRef = useRef<HTMLDivElement>(null);

  const amount = useMemo(() => calculatePrice(router.query), [router.query])

// Unique address that we can listen for payments to
	const reference = useMemo(() => Keypair.generate().publicKey, [])

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

  return (
    <div className="flex flex-col gap-8 items-center">
      <BackLink href='/shop'>Cancel</BackLink>
      <PageHeading>Checkout ${amount.toString()}</PageHeading>
	  <div ref={qrRef} />
    </div>
  )
}
