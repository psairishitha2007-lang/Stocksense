import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'

export default function ItemCode({ value, mode = 'qr' }) {
  if (!value) return null

  if (mode === 'barcode') {
    return (
      <Barcode
        value={String(value)}
        height={40}
        width={1.4}
        fontSize={12}
        margin={4}
      />
    )
  }

  return <QRCodeSVG value={String(value)} size={72} />
}