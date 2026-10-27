import { FlaskConical, Package, PackageX, ShieldCheck, Sparkles, Stethoscope, type LucideProps } from 'lucide-react'

/** Icon for a service type (package, lab_test, wellness, service, insurance); neutral icon otherwise. */
export function ServiceTypeIcon({ type, ...props }: { type: string } & LucideProps) {
  switch (type) {
    case 'package':
      return <Package {...props} />
    case 'lab_test':
      return <FlaskConical {...props} />
    case 'wellness':
      return <Sparkles {...props} />
    case 'service':
      return <Stethoscope {...props} />
    case 'insurance':
      return <ShieldCheck {...props} />
    default:
      return <PackageX {...props} />
  }
}
