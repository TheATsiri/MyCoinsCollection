import { useLanguage } from '../i18n/useLanguage'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Coins, Layers3 } from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
import { isDemo } from '../lib/supabase'
export default function About() {
  const { t } = useLanguage()

  useTitle('About the collection')
  return (
    <section className="container about-section">
      <p className="eyebrow">{t('THE STORY BEHIND THE CABINET')}</p>
      <h1>
        {t('A collection starts')}
        <br />
        {t('with')} <em>{t('curiosity.')}</em>
      </h1>
      <p className="about-lead">
        {t(
          'Coins bring history within reach. Their designs tell us what a place chose to remember, celebrate, and share with the world.',
        )}
      </p>
      <div className="about-grid">
        <section>
          <BookOpen size={26} />
          <h2>{t('A considered catalogue')}</h2>
          <p>
            {t(
              'This website makes room for the detail in every specimen: its origin, materials, imagery, and historical context. Specifications and references can be recorded alongside both sides of the coin.',
            )}
          </p>
        </section>
        <section>
          <Layers3 size={26} />
          <h2>{t('Room for discovery')}</h2>
          <p>
            {t(
              'Not every detail is known immediately. Unrecorded information stays clearly marked, and research can be added as the collection develops.',
            )}
          </p>
        </section>
        <section>
          <Coins size={26} />
          <h2>{t('Public stories, private records')}</h2>
          <p>
            {t(
              'Visitors can explore published coins and photographs. Ownership notes, acquisition details, and financial records belong in the owner’s private catalogue.',
            )}
          </p>
        </section>
      </div>
      {isDemo && (
        <div className="detail-demo">
          <strong>{t('You are viewing a demonstration.')}</strong>{' '}
          {t(
            'The sample coins and original illustrations preview the design. The owner’s introduction and verified specimen photographs can be added when the collection is connected.',
          )}
        </div>
      )}
      <Link className="button" to="/collection">
        {t('Step into the collection')}
        <ArrowRight size={17} />
      </Link>
    </section>
  )
}
