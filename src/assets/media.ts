import heroImg from './images/hero_maputo_marketplace_1793955453478.jpg';
import hairImg from './images/service_beauty_hair_1793955453090.jpg';
import barberImg from './images/service_barber_grooming_1793955453759.jpg';
import maintenanceImg from './images/service_home_maintenance_1793955454128.jpg';
import wellnessImg from './images/service_cleaning_wellness_1793955453736.jpg';

export const APP_MEDIA = {
  hero: heroImg,
  hair: hairImg,
  barber: barberImg,
  maintenance: maintenanceImg,
  wellness: wellnessImg,
};

const PATH_LOOKUP: Record<string, string> = {
  '/src/assets/images/hero_maputo_marketplace_1793955453478.jpg': heroImg,
  '/src/assets/images/service_beauty_hair_1793955453090.jpg': hairImg,
  '/src/assets/images/service_barber_grooming_1793955453759.jpg': barberImg,
  '/src/assets/images/service_home_maintenance_1793955454128.jpg': maintenanceImg,
  '/src/assets/images/service_cleaning_wellness_1793955453736.jpg': wellnessImg,
};

export function resolveMediaUrl(url?: string, fallbackKey: keyof typeof APP_MEDIA = 'hero'): string {
  if (!url || !url.trim()) {
    return APP_MEDIA[fallbackKey];
  }
  const trimmed = url.trim();
  if (PATH_LOOKUP[trimmed]) {
    return PATH_LOOKUP[trimmed];
  }
  return trimmed;
}

export const PRESET_GALLERY_CHOICES: Array<{ label: string; url: string }> = [
  { label: 'Estúdio e Beleza (Maputo)', url: hairImg },
  { label: 'Barbearia Moderna', url: barberImg },
  { label: 'Manutenção Residencial', url: maintenanceImg },
  { label: 'Limpeza e Bem-Estar', url: wellnessImg },
  { label: 'Atendimento Profissional', url: heroImg },
];
