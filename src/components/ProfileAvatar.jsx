import { useEffect, useState } from 'react'
import { getSignedUrl } from '../data/storage'

export default function ProfileAvatar({ path, initials, className, previewUrl = '', refreshKey }) {
  const [signedUrl, setSignedUrl] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    setSignedUrl('')
    setFailed(false)
    if (!path || previewUrl) return () => { active = false }

    void getSignedUrl(path).then(({ url, error }) => {
      if (!active) return
      if (error || !url) {
        if (error) console.error('Could not load profile photo:', error)
        setFailed(true)
        return
      }
      setSignedUrl(url)
    })

    return () => { active = false }
  }, [path, previewUrl, refreshKey])

  const imageUrl = previewUrl || signedUrl
  return (
    <span className={`${className} profile-avatar-image`} aria-label={imageUrl && !failed ? 'Your profile photo' : `Avatar initials ${initials}`}>
      {imageUrl && !failed
        ? <img src={imageUrl} alt="Your profile photo" onError={(event) => {
          console.error('Profile photo could not be displayed:', event.currentTarget.src)
          setFailed(true)
        }} />
        : initials}
    </span>
  )
}
