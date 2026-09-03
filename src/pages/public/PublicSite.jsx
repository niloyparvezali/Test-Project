import React from 'react';
import { useDoc } from '../../hooks/useFirestore';
import Home from './Home';
import Booking from './Booking';

export default function PublicSite({ go, route }) {
  const [turf] = useDoc('turf/main');
  const [settings] = useDoc('settings/config');
  const [pricing] = useDoc('pricing/current');
  const isBooking = route === '/book' || route === '/book/';
  return isBooking ? <Booking go={go} turf={turf} settings={settings} pricing={pricing} /> : <Home go={go} turf={turf} settings={settings} />;
}
