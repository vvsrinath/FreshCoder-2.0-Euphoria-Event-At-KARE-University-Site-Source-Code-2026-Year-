import React from 'react';
import { PortalLayout } from '../../components/PortalLayout';
import { Card, CardHeader } from '../../components/Card';
import { studentNav } from './studentNav';
import { eventConfig, guidelines } from '../../data/eventConfig';

const examRules = [
'Each question must be answered and then locked using “Lock & Next”.',
'A locked answer cannot be edited unless examination staff approve a modification request.',
'The countdown shown in the exam is a display of the server deadline. The server finalises your attempt when time expires.',
'Examination staff may lock your attempt, extend the duration, or force-submit your paper.',
'Leaving fullscreen, switching tabs and navigation attempts are recorded as monitoring events.'];


export function Instructions() {
  return (
    <PortalLayout portalLabel="Student Portal" navItems={studentNav}>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-navy-800">Examination instructions</h1>
          <p className="mt-1 text-sm text-slate-600">
            {eventConfig.name} · {eventConfig.subtitle} · Theme: {eventConfig.theme}
          </p>
        </div>

        <Card>
          <CardHeader title="Before the test" />
          <ul className="space-y-2 px-5 py-4 text-sm text-slate-700">
            {guidelines.map((line) =>
            <li key={line} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                {line}
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="During the test" />
          <ul className="space-y-2 px-5 py-4 text-sm text-slate-700">
            {examRules.map((line) =>
            <li key={line} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" aria-hidden="true" />
                {line}
              </li>
            )}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Venue and schedule" />
          <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</dt>
              <dd className="mt-1 font-medium text-navy-800">{eventConfig.date}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</dt>
              <dd className="mt-1 font-medium text-navy-800">{eventConfig.time}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Venue</dt>
              <dd className="mt-1 font-medium text-navy-800">
                {eventConfig.venueBlock}, {eventConfig.venueRooms}
              </dd>
            </div>
          </dl>
        </Card>
      </div>
    </PortalLayout>);

}