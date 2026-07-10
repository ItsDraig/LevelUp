import BottomNav from '@/components/layout/BottomNav'

export default function StubPage() {
  return (
    <div className="flex flex-col flex-1" style={{ minHeight: '100dvh' }}>
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-sm" style={{ color: 'var(--text2)' }}>Coming soon.</p>
      </div>
      <BottomNav />
    </div>
  )
}
