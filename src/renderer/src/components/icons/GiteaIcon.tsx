export function GiteaIcon({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      {/* Why: minimal G monogram so the provider reads as Gitea/Forgejo in
      Orca's monochrome provider-icon set instead of a branded tile. */}
      <path d="M12 2a10 10 0 1 0 9.54 13h-4.6v-2.6h1.7a6.6 6.6 0 1 1-1.94-4.65l2.42-2.42A9.97 9.97 0 0 0 12 2Zm-.35 7.2v3.7l3.2 1.86.89-1.54-2.31-1.33V9.2h-1.78Z" />
    </svg>
  )
}
