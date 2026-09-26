import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IslandDrive',
    short_name: 'IslandDrive',
    description: 'Rent cars from locals in Trinidad & Tobago',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#0c7f75',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
