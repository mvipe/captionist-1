import Navbar from '@/components/landing/Navbar';
import Hero from '@/components/landing/Hero';
import { Creators, LanguageSelect } from '@/components/landing/Creators';
import Templates from '@/components/landing/Templates';
import { ExportNLE, Accuracy } from '@/components/landing/Features';
import Testimonials from '@/components/landing/Testimonials';
import Pricing from '@/components/landing/Pricing';
import { FAQ, Footer } from '@/components/landing/FAQ';
import { getLandingContent } from '@/lib/landingContent';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const { testimonials, creators, languages, templateVideos } = await getLandingContent();
  return (
    <main>
      <Navbar />
      <Hero />
      <Creators creators={creators} />
      <LanguageSelect languages={languages} />
      <Accuracy />
      <Templates videos={templateVideos} />
      <ExportNLE />
      <Testimonials testimonials={testimonials} />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
