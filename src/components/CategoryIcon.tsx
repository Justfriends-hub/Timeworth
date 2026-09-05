import React from 'react';
import {
  Apple,
  Briefcase,
  UtensilsCrossed,
  Car,
  Zap,
  GraduationCap,
  PiggyBank,
  PawPrint,
  Sparkles,
  Gamepad2,
  Film,
  ShoppingBag,
  Home,
  Heart,
  Plane,
  Gift,
  Coffee,
  Wifi,
  ShieldCheck,
  Tv,
  Laptop,
  TrendingUp,
  CarFront,
  HelpCircle,
  LucideProps,
} from 'lucide-react';

interface CategoryIconProps extends LucideProps {
  name: string;
  className?: string;
  size?: number;
}

const iconMap: Record<string, React.FC<LucideProps>> = {
  Apple,
  Briefcase,
  UtensilsCrossed,
  Car,
  Zap,
  GraduationCap,
  PiggyBank,
  PawPrint,
  Sparkles,
  Gamepad2,
  Film,
  ShoppingBag,
  Home,
  Heart,
  Plane,
  Gift,
  Coffee,
  Wifi,
  ShieldCheck,
  Tv,
  Laptop,
  TrendingUp,
  CarFront,
};

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-5 h-5', size, ...props }) => {
  const IconComponent = iconMap[name] || HelpCircle;
  return <IconComponent className={className} size={size} {...props} />;
};
