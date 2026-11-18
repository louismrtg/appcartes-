import React from 'react';
import {
  Car,
  Coffee,
  Dumbbell,
  Folder,
  Gift,
  Hammer,
  Heart,
  Laptop,
  Lock,
  ShoppingCart,
  Sparkles,
  Star,
} from 'lucide-react';
import { FolderIconName } from '../types';

interface FolderIconProps {
  icon: FolderIconName;
  className?: string;
}

export const FolderIcon: React.FC<FolderIconProps> = ({ icon, className = 'w-5 h-5' }) => {
  switch (icon) {
    case 'shopping-cart':
      return <ShoppingCart className={className} strokeWidth={1.75} />;
    case 'hammer':
      return <Hammer className={className} strokeWidth={1.75} />;
    case 'dumbbell':
      return <Dumbbell className={className} strokeWidth={1.75} />;
    case 'car':
      return <Car className={className} strokeWidth={1.75} />;
    case 'sparkles':
      return <Sparkles className={className} strokeWidth={1.75} />;
    case 'heart':
      return <Heart className={className} strokeWidth={1.75} />;
    case 'laptop':
      return <Laptop className={className} strokeWidth={1.75} />;
    case 'lock':
      return <Lock className={className} strokeWidth={1.75} />;
    case 'star':
      return <Star className={className} strokeWidth={1.75} />;
    case 'gift':
      return <Gift className={className} strokeWidth={1.75} />;
    case 'coffee':
      return <Coffee className={className} strokeWidth={1.75} />;
    case 'folder':
    default:
      return <Folder className={className} strokeWidth={1.75} />;
  }
};

export const FOLDER_ICON_OPTIONS: { id: FolderIconName; label: string }[] = [
  { id: 'shopping-cart', label: 'Courses' },
  { id: 'hammer', label: 'Maison' },
  { id: 'dumbbell', label: 'Sport' },
  { id: 'sparkles', label: 'Mode' },
  { id: 'car', label: 'Auto' },
  { id: 'laptop', label: 'Tech' },
  { id: 'heart', label: 'Santé' },
  { id: 'gift', label: 'Cadeaux' },
  { id: 'coffee', label: 'Restos' },
  { id: 'star', label: 'Favoris' },
  { id: 'lock', label: 'Privé' },
  { id: 'folder', label: 'Dossier' },
];
