import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { generateSlots } from '../../utils/slotUtils';
import { localDate, timeLabel } from '../../utils/dateUtils';
import { getSlotStatus } from '../../utils/slotStatus';
import PublicHeader from '../../components/public/PublicHeader';
import ModeSwitcher from '../../components/public/ModeSwitcher';
import HeroSection from '../../components/public/HeroSection';
import QuickInfo from '../../components/public/QuickInfo';
import AboutSection from '../../components/public/AboutSection';
import TurfDetails from '../../components/public/TurfDetails';
import LocationSection from '../../components/public/LocationSection';
import GallerySection from '../../components/public/GallerySection';
import FinalBookingCTA from '../../components/public/FinalBookingCTA';
import PublicFooter from '../../components/public/PublicFooter';
import { displayBrand } from '../../config/brand';
import { turfGallery } from '../../data/gallery';

function operatingHoursLabel(settings = {}) {
  const opening = String(settings.openingTime || '').trim();
  const closing = String(settings.closingTime || '').trim();
  if (!opening || !closing) return '';
  if (opening === closing || (opening === '00:00' && closing === '24:00')) return '24 Hours';
  return `${timeLabel(opening)} — ${timeLabel(closing)}`;
}

export default function Home({ go, turf = {}, settings = {} }) {
  const [locks, setLocks] = useState([]);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const today = localDate();

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, 'slotLocks'), where('sessionDate', '==', today)),
        snap => {
          setLocks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setAvailabilityReady(true);
        },
        () => {
          setLocks([]);
          setAvailabilityReady(false);
        }
      ),
    [today]
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const availability = useMemo(() => {
    if (!availabilityReady) return null;
    const slots = generateSlots(today, settings);
    const byKey = new Map(locks.map(lock => [lock.id, lock]));
    return slots.filter(slot => getSlotStatus(slot, null, byKey.get(slot.key)) === 'available').length;
  }, [locks, settings, today, now, availabilityReady]);

  const hours = operatingHoursLabel(settings);

  return (
    <div className="bt-app bt-home-page">
      <PublicHeader />
      <main>
        <HeroSection turf={turf} gallery={turfGallery} go={go} />
        <QuickInfo hours={hours} duration={settings.slotDuration} availability={availability} />
        <AboutSection turf={turf} />
        <TurfDetails turf={turf} settings={settings} />
        <LocationSection turf={turf} />
        <GallerySection gallery={turfGallery} />
        <FinalBookingCTA go={go} />
      </main>
      <PublicFooter go={go} />
      <ModeSwitcher route="/" go={go} />
    </div>
  );
}

export function homeTitle(turf) {
  return displayBrand(turf?.name);
}
