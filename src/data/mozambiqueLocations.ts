export interface NeighborhoodCoord {
  name: string;
  lat: number;
  lng: number;
}

export interface MozCity {
  name: string;
  province: string;
  lat: number;
  lng: number;
  neighborhoods: NeighborhoodCoord[];
}

export const MOZAMBIQUE_CITIES: MozCity[] = [
  {
    name: 'Maputo',
    province: 'Maputo Cidade',
    lat: -25.9692,
    lng: 32.5732,
    neighborhoods: [
      { name: 'Polana Cimento', lat: -25.9665, lng: 32.5920 },
      { name: 'Sommerschield', lat: -25.9554, lng: 32.5978 },
      { name: 'Baixa', lat: -25.9752, lng: 32.5715 },
      { name: 'Alto Maé', lat: -25.9628, lng: 32.5675 },
      { name: 'Malhangalene', lat: -25.9540, lng: 32.5795 },
      { name: 'Coop', lat: -25.9482, lng: 32.5890 },
      { name: 'Triunfo', lat: -25.9325, lng: 32.6285 },
      { name: 'Costa do Sol', lat: -25.9185, lng: 32.6410 },
      { name: 'Benfica', lat: -25.8990, lng: 32.5590 },
      { name: 'Zimpeto', lat: -25.8475, lng: 32.5740 },
    ],
  },
  {
    name: 'Matola',
    province: 'Maputo Província',
    lat: -25.9622,
    lng: 32.4589,
    neighborhoods: [
      { name: 'Matola A', lat: -25.9680, lng: 32.4630 },
      { name: 'Matola C', lat: -25.9550, lng: 32.4695 },
      { name: 'Machava', lat: -25.9270, lng: 32.5020 },
      { name: 'Liberdade', lat: -25.9415, lng: 32.4825 },
      { name: 'Tchumene', lat: -25.9150, lng: 32.4420 },
      { name: 'Fomento', lat: -25.9610, lng: 32.4870 },
      { name: 'Patrice Lumumba', lat: -25.9460, lng: 32.4510 },
    ],
  },
  {
    name: 'Beira',
    province: 'Sofala',
    lat: -19.8436,
    lng: 34.8389,
    neighborhoods: [
      { name: 'Ponta Gêa', lat: -19.8455, lng: 34.8350 },
      { name: 'Macuti', lat: -19.8390, lng: 34.8640 },
      { name: 'Chaimite', lat: -19.8350, lng: 34.8410 },
      { name: 'Munhava', lat: -19.8210, lng: 34.8520 },
    ],
  },
  {
    name: 'Nampula',
    province: 'Nampula',
    lat: -15.1165,
    lng: 39.2666,
    neighborhoods: [
      { name: 'Centro Urbano', lat: -15.1165, lng: 39.2666 },
      { name: 'Muatala', lat: -15.1280, lng: 39.2540 },
      { name: 'Napipine', lat: -15.1040, lng: 39.2790 },
    ],
  },
  {
    name: 'Xai-Xai',
    province: 'Gaza',
    lat: -25.0519,
    lng: 33.6442,
    neighborhoods: [
      { name: 'Cidade Baixa', lat: -25.0519, lng: 33.6442 },
      { name: 'Praia de Xai-Xai', lat: -25.1180, lng: 33.7290 },
    ],
  },
  {
    name: 'Inhambane',
    province: 'Inhambane',
    lat: -23.8650,
    lng: 35.3833,
    neighborhoods: [
      { name: 'Centro Histórico', lat: -23.8650, lng: 35.3833 },
      { name: 'Praia do Tofo', lat: -23.8545, lng: 35.5470 },
    ],
  },
  {
    name: 'Chimoio',
    province: 'Manica',
    lat: -19.1164,
    lng: 33.4833,
    neighborhoods: [
      { name: 'Centro', lat: -19.1164, lng: 33.4833 },
      { name: 'Soalpo', lat: -19.1080, lng: 33.4950 },
    ],
  },
  {
    name: 'Tete',
    province: 'Tete',
    lat: -16.1564,
    lng: 33.5867,
    neighborhoods: [
      { name: 'Chingodzi', lat: -16.1420, lng: 33.6190 },
      { name: 'Filipe Samuel Magaia', lat: -16.1590, lng: 33.5820 },
    ],
  },
  {
    name: 'Quelimane',
    province: 'Zambézia',
    lat: -17.8786,
    lng: 36.8883,
    neighborhoods: [
      { name: 'Centro', lat: -17.8786, lng: 36.8883 },
      { name: 'Sangareia', lat: -17.8690, lng: 36.8980 },
    ],
  },
  {
    name: 'Pemba',
    province: 'Cabo Delgado',
    lat: -12.9740,
    lng: 40.5178,
    neighborhoods: [
      { name: 'Wimbe', lat: -12.9650, lng: 40.5480 },
      { name: 'Cimento', lat: -12.9740, lng: 40.5178 },
    ],
  },
];

export function resolveLocationCoords(city: string, neighborhood?: string): { lat: number; lng: number } {
  const normalizedCity = city.trim().toLowerCase();
  const foundCity =
    MOZAMBIQUE_CITIES.find((c) => c.name.toLowerCase() === normalizedCity) || MOZAMBIQUE_CITIES[0];

  if (neighborhood) {
    const normalizedNb = neighborhood.trim().toLowerCase();
    const foundNb = foundCity.neighborhoods.find((n) => n.name.toLowerCase() === normalizedNb);
    if (foundNb) {
      return { lat: foundNb.lat, lng: foundNb.lng };
    }
  }
  return { lat: foundCity.lat, lng: foundCity.lng };
}

export function findNearestMozCity(lat: number, lng: number): { city: string; neighborhood: string } {
  let bestCity = MOZAMBIQUE_CITIES[0];
  let bestNb = MOZAMBIQUE_CITIES[0].neighborhoods[0];
  let minSqDist = Number.POSITIVE_INFINITY;

  for (const city of MOZAMBIQUE_CITIES) {
    for (const nb of city.neighborhoods) {
      const dLat = nb.lat - lat;
      const dLng = nb.lng - lng;
      const sq = dLat * dLat + dLng * dLng;
      if (sq < minSqDist) {
        minSqDist = sq;
        bestCity = city;
        bestNb = nb;
      }
    }
  }
  return { city: bestCity.name, neighborhood: bestNb.name };
}
