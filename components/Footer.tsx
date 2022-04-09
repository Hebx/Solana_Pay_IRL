export default function Footer() {
  const TWITTER_HANDLE = "LordHeb";
const TWITTER_LINK = `https://twitter.com/${TWITTER_HANDLE}`;

  return (
    <footer className="flex w-full justify-center border-t-2 border-gray-900 py-12 h-10">
      <a
        href= 'https://twitter.com/LordHeb'
        target='_blank'
        rel='noopener noreferrer'
      >
        Made with 💜 by {" "}
        <span>
          Hebx
        </span>
      </a>
    </footer>
  )
}
