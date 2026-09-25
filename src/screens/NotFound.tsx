import { Link } from 'react-router';
import { Compass } from '@phosphor-icons/react';
import { usePageTitle } from '../components/Page';

export function NotFound({ what = 'page' }: { what?: string }) {
  usePageTitle('Not found');
  return (
    <div className="page empty">
      <Compass size={48} aria-hidden />
      <h1>We couldn’t find that {what}</h1>
      <p>The link may be old or mistyped. Nothing about your progress has changed.</p>
      <div className="btn-row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-primary">
          Go to Learn
        </Link>
        <Link to="/glossary" className="btn">
          Open the glossary
        </Link>
      </div>
    </div>
  );
}
