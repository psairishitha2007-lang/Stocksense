import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'

export default function ItemCode({ value, mode = 'qr' }) {
  const code = String(value ?? '').trim()
  if (!code) return null

  if (mode === 'barcode') {
    return (
      <span className="item-code item-code-barcode" aria-label={`Barcode for ${code}`} role="img">
        <Barcode
          value={code}
          height={40}
          width={1.4}
          fontSize={12}
          margin={4}
        />
      </span>
    )
  }

  return (
    <span className="item-code item-code-qr" aria-label={`QR code for ${code}`} role="img">
      <QRCodeSVG value={code} size={72} />
    </span>
  )
}