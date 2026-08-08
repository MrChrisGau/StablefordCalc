import { useState } from 'react'
import QRCode from 'qrcode'
import { useTranslation } from '../i18n'

interface Props {
  code: string
}

function joinUrl(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?join=${code}`
}

export default function LiveShareButton({ code }: Props) {
  const { t } = useTranslation()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    const url = joinUrl(code)
    if (navigator.share) {
      try {
        await navigator.share({ title: t('live.shareTitle'), text: t('live.shareText', { code }), url })
      } catch {
        // Nutzer hat den Teilen-Dialog abgebrochen — kein Fehlerfall.
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Link konnte nicht kopiert werden', error)
    }
  }

  async function toggleQr() {
    if (qrDataUrl) {
      setQrDataUrl(null)
      return
    }
    try {
      const dataUrl = await QRCode.toDataURL(joinUrl(code), { margin: 1, width: 240 })
      setQrDataUrl(dataUrl)
    } catch (error) {
      console.error('QR-Code konnte nicht erzeugt werden', error)
    }
  }

  return (
    <div>
      <div className="stack">
        <button className="secondary" onClick={handleShare}>
          {copied ? t('live.linkCopied') : t('live.shareButton')}
        </button>
        <button className="secondary" onClick={toggleQr}>
          {qrDataUrl ? t('live.hideQr') : t('live.showQr')}
        </button>
      </div>
      {qrDataUrl && (
        <div className="live-qr">
          <img src={qrDataUrl} alt={t('live.qrAlt')} width={240} height={240} />
        </div>
      )}
    </div>
  )
}
