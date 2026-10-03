import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Coins, Layers3 } from 'lucide-react'
import { useTitle } from '../hooks/useTitle'
import { isDemo } from '../lib/supabase'
export default function About() {
  useTitle('About the collection')
  return (
    <section className="container about-section">
      <p className="eyebrow">THE STORY BEHIND THE CABINET</p>
      <h1>
        A collection starts
        <br />
        with <em>curiosity.</em>
      </h1>
      <p className="about-lead">
        Coins bring history within reach. Their designs tell us what a place
        chose to remember, celebrate, and share with the world.
      </p>
      <div className="about-grid">
        <section>
          <BookOpen size={26} />
          <h2>A considered catalogue</h2>
          <p>
            This website makes room for the detail in every specimen: its
            origin, materials, imagery, and historical context. Specifications
            and references can be recorded alongside both sides of the coin.
          </p>
        </section>
        <section>
          <Layers3 size={26} />
          <h2>Room for discovery</h2>
          <p>
            Not every detail is known immediately. Unrecorded information stays
            clearly marked, and research can be added as the collection
            develops.
          </p>
        </section>
        <section>
          <Coins size={26} />
          <h2>Public stories, private records</h2>
          <p>
            Visitors can explore published coins and photographs. Ownership
            notes, acquisition details, and financial records belong in the
            owner’s private catalogue.
          </p>
        </section>
      </div>
      {isDemo && (
        <div className="detail-demo">
          <strong>You are viewing a demonstration.</strong> The sample coins and
          original illustrations preview the design. The owner’s introduction
          and verified specimen photographs can be added when the collection is
          connected.
        </div>
      )}
      <Link className="button" to="/collection">
        Step into the collection
        <ArrowRight size={17} />
      </Link>
    </section>
  )
}
