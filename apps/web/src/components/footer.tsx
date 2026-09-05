import Link from "next/link";
import { Facebook, Instagram, Mail, Phone, MapPin } from "lucide-react";
import type { PublicSettings } from "@/lib/settings";

export function Footer({ settings }: { settings: PublicSettings }) {
  return (
    <footer className="mt-20 border-t border-ink/10 bg-white">
      <div className="container-x grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <h3 className="font-display text-xl">{settings.branding.siteName}</h3>
          <p className="mt-2 text-sm text-ink/60">{settings.branding.tagline}</p>
          <div className="mt-4 flex gap-3">
            {settings.social.facebook && (
              <a href={settings.social.facebook} target="_blank" rel="noreferrer" className="text-ink/50 hover:text-brand">
                <Facebook size={18} />
              </a>
            )}
            {settings.social.instagram && (
              <a href={settings.social.instagram} target="_blank" rel="noreferrer" className="text-ink/50 hover:text-brand">
                <Instagram size={18} />
              </a>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Shop</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/60">
            <li><Link href="/categories/cosmetics" className="hover:text-brand">Cosmetics</Link></li>
            <li><Link href="/categories/fashion" className="hover:text-brand">Fashion</Link></li>
            <li><Link href="/products?featured=true" className="hover:text-brand">Featured</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/60">
            <li><Link href="/pages/about-us" className="hover:text-brand">About Us</Link></li>
            <li><Link href="/pages/terms-conditions" className="hover:text-brand">Terms &amp; Conditions</Link></li>
            <li><Link href="/pages/privacy-policy" className="hover:text-brand">Privacy Policy</Link></li>
            <li><Link href="/pages/contact-us" className="hover:text-brand">Contact Us</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold">Get in touch</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink/60">
            {settings.contact.phone && (
              <li className="flex items-center gap-2"><Phone size={14} /> {settings.contact.phone}</li>
            )}
            {settings.contact.email && (
              <li className="flex items-center gap-2"><Mail size={14} /> {settings.contact.email}</li>
            )}
            {settings.contact.address && (
              <li className="flex items-center gap-2"><MapPin size={14} /> {settings.contact.address}</li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/10 py-4 text-center text-xs text-ink/50">
        © {new Date().getFullYear()} {settings.branding.siteName}. All rights reserved.
      </div>
    </footer>
  );
}
