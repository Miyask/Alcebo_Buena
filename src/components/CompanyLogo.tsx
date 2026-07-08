import React from 'react';
import logoUrl from '../assets/logo.png';

interface CompanyLogoProps {
  className?: string;
  variant?: 'full' | 'icon-only' | 'text-only';
  height?: number;
  isDarkBg?: boolean;
}

export default function CompanyLogo({ className = '', variant = 'full', height = 48, isDarkBg = false }: CompanyLogoProps) {
  // Renders the official Alcebo brand logo image extracted from attachments.
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={logoUrl} 
        alt="Alcebo Control de Aves" 
        style={{ height: `${height}px`, width: 'auto' }} 
        className="object-contain"
      />
    </div>
  );
}
