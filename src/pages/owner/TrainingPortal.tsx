import { TrainingCertificationLibrary } from '@/components/training/TrainingCertificationLibrary';
import { useAuth } from '@/hooks/useAuth';

export default function TrainingPortal() {
  const { activeBusiness, profile, user } = useAuth();
  const participantName = profile?.full_name || user?.user_metadata?.full_name || user?.email || 'Velliqo Owner';

  return (
    <TrainingCertificationLibrary
      audience="owner"
      business={activeBusiness}
      userId={user?.id}
      participantName={participantName}
    />
  );
}
