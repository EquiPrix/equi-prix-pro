import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import EquiPrixLogo from '@/components/equiprix/EquiPrixLogo';

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview & No Purchase Necessary',
    content: `EquiPrix is a free-to-play fantasy sports platform for elite show jumping competitions including but not limited to the Longines Global Champions Tour (LGCT), Global Champions League (GCL), Postillion Hotels & Resorts Jumping League (PJL), Major League Show Jumping (MLSJ), and any other leagues added to the platform in the future.

Participation in EquiPrix is completely free. No purchase, payment, or financial contribution of any kind is required to register, participate, or compete. The absence of any purchase requirement means EquiPrix does not constitute gambling, a lottery, or a game of chance under applicable law.

Any prizes offered within the platform are provided at the sole discretion of EquiPrix, room managers, or sponsors, and are subject to their own terms and conditions.`
  },
  {
    id: 'eligibility',
    title: '2. Eligibility',
    content: `EquiPrix is open to participants worldwide except where prohibited by applicable local law. By registering, you confirm that:

• You are at least 18 years of age, or the age of majority in your jurisdiction, whichever is greater.
• Your participation does not violate any applicable law or regulation in your jurisdiction.
• You are not an employee, contractor, officer, or director of EquiPrix, or an immediate family member or household member of such persons.
• You have the legal capacity to enter into these Terms and Conditions.

EquiPrix reserves the right to verify eligibility and to disqualify any participant who does not meet these requirements.`
  },
  {
    id: 'platform',
    title: '3. Platform Description',
    content: `EquiPrix is a fantasy sports game in which participants select a virtual team of professional show jumping riders and teams from real-world competitions. Points are awarded based on the actual performance of those riders and teams in live events.

The platform operates as follows:

• Participants draft a team of riders and GCL teams within a salary cap for each event.
• Points are calculated based on results including finishing position, clear rounds, and jump-off performance.
• Leaderboards are maintained for individual events, full seasons, and private rooms.
• Results are entered manually by EquiPrix administrators based on official event results.

EquiPrix makes no guarantee of real-time accuracy of results and reserves the right to correct errors in scoring at any time.`
  },
  {
    id: 'fantasy',
    title: '4. Fantasy Game — Not Gambling',
    content: `EquiPrix is a game of skill, not chance. Participant scores are determined primarily by the knowledge, judgment, and skill applied in selecting riders and teams, not by random chance.

EquiPrix is not a gambling platform. Specifically:

• No money or thing of financial value is required to enter.
• Prizes, where offered, are awarded based on performance within a free-to-play game.
• EquiPrix does not operate, facilitate, or endorse real-money wagering of any kind.

Any future real-money contest features, if introduced, will be subject to separate terms, legal review, and jurisdictional compliance, and will be clearly distinguished from the current free-to-play platform.

Participants are solely responsible for determining whether their participation is lawful in their jurisdiction.`
  },
  {
    id: 'prizes',
    title: '5. Prizes & Sponsored Rooms',
    content: `Prizes may be offered within EquiPrix through:

(a) Platform-level competitions: EquiPrix may, at its sole discretion, offer prizes to top performers on the main leaderboard.

(b) Private rooms: Room managers may establish prizes for their private rooms. These prizes are the responsibility of the room manager and are independent of EquiPrix. EquiPrix makes no warranty, representation, or guarantee regarding prizes offered by room managers or sponsors.

(c) Sponsored rooms: Third-party sponsors may offer prizes through sponsored rooms. Sponsored prizes are governed by the sponsor's own terms and conditions.

All prizes are subject to applicable law. Recipients may be required to provide identification, proof of eligibility, and tax information where required by law. EquiPrix reserves the right to withhold prizes pending eligibility verification.

No purchase is necessary to win any prize.`
  },
  {
    id: 'scoring',
    title: '6. Scoring & Results',
    content: `Scoring is based on official results from the relevant governing bodies including the Fédération Equestre Internationale (FEI), LGCT, GCL, PJL, MLSJ, and any other leagues supported by the platform.

EquiPrix scores are calculated as follows:

• Grand Prix results: Points awarded based on finishing position, with additional points for clear rounds and jump-off performance.
• GCL Team results: Points awarded based on team finishing position in each event.
• Captain multiplier: A designated captain receives a 1.5× points multiplier.

EquiPrix reserves the right to:
• Correct scoring errors at any time.
• Adjust or disqualify scores where results are revised by the event organiser.
• Modify the scoring system between seasons with notice.

In the event of a dispute regarding scores, EquiPrix's decision is final.`
  },
  {
    id: 'conduct',
    title: '7. User Conduct',
    content: `By using EquiPrix, you agree to:

• Provide accurate registration information.
• Use the platform only for its intended purpose.
• Not create multiple accounts to gain competitive advantage.
• Not attempt to manipulate scores, leaderboards, or results.
• Not use automated tools, bots, or scripts to interact with the platform.
• Not impersonate another user, room manager, or EquiPrix staff.
• Not share content that is unlawful, offensive, or harmful.
• Not reverse engineer or attempt to access non-public areas of the platform.

EquiPrix reserves the right to suspend or permanently disqualify any user found to be in violation of these conduct standards, without notice and without liability.`
  },
  {
    id: 'ip',
    title: '8. Intellectual Property',
    content: `All content on EquiPrix, including but not limited to the platform name, logo, design, scoring system, and copy, is the intellectual property of EquiPrix and may not be reproduced, distributed, or used without prior written permission.

EquiPrix is not affiliated with, endorsed by, or in partnership with the Longines Global Champions Tour, Global Champions League, The Premier Jumping League, Major League Show Jumping, or the FEI unless explicitly stated. Rider names, team names, and competition results used within the platform are for informational and entertainment purposes within the context of a fantasy sports game.

The EquiPrix platform and its content are protected by applicable intellectual property laws.`
  },
  {
    id: 'privacy',
    title: '9. Privacy & Data',
    content: `EquiPrix collects the following personal data:

• Email address (for account creation and communications)
• Display name (chosen by the user)
• Picks and scores (for leaderboard functionality)
• Email communication preferences (for notification management)

Your data is stored securely via Supabase and is not sold to third parties. Your email address may be used to send event notifications, results, and platform updates. You may unsubscribe from email communications at any time via your account settings.

By registering, you consent to the collection and use of your data as described. For questions regarding your data, contact info@playequiprix.com.`
  },
  {
    id: 'disclaimer',
    title: '10. Disclaimer & Limitation of Liability',
    content: `EquiPrix is provided "as is" without warranties of any kind, express or implied.

EquiPrix makes no representations regarding:
• The accuracy or timeliness of results and scores.
• The availability or uptime of the platform.
• The conduct or performance of room managers or sponsors.

To the fullest extent permitted by law, EquiPrix shall not be liable for:
• Any indirect, incidental, or consequential damages arising from use of the platform.
• Loss of prizes, opportunities, or data.
• Actions or omissions of third-party room managers, sponsors, or event organisers.

Your use of EquiPrix is at your own risk.`
  },
  {
    id: 'modifications',
    title: '11. Modifications',
    content: `EquiPrix reserves the right to modify these Terms and Conditions at any time. Continued use of the platform following any modification constitutes acceptance of the updated terms.

EquiPrix also reserves the right to:
• Modify, suspend, or discontinue any feature or the platform itself at any time.
• Add or remove supported leagues and competitions.
• Change the scoring system, salary cap, or draft mechanics between events or seasons.
• Cancel or modify prizes in extraordinary circumstances.

Material changes will be communicated via email where possible.`
  },
  {
    id: 'governing',
    title: '12. Governing Law',
    content: `These Terms and Conditions shall be governed by and construed in accordance with applicable law. Any disputes arising from or related to these terms or the use of EquiPrix shall be resolved through good-faith negotiation, and if unresolved, through binding arbitration.

By using EquiPrix, you agree to waive any right to a jury trial or class action lawsuit in connection with any dispute arising from these terms or your use of the platform.`
  },
  {
    id: 'contact',
    title: '13. Contact',
    content: `For questions, concerns, or requests related to these Terms and Conditions, please contact:

EquiPrix
Email: info@playequiprix.com
Website: playequiprix.com

Last updated: June 2026`
  },
];

export default function Terms() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(null);

  return (
    <div className="min-h-screen" style={{ background: '#0f0e0a' }}>
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between sticky top-0 z-10"
        style={{ background: '#0a0907', borderBottom: '1px solid rgba(180,149,48,0.2)' }}>
        <button onClick={() => navigate(-1)}
          className="font-cinzel text-xs px-3 py-1.5 rounded transition-all"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(180,149,48,0.15)', color: 'var(--mid)', letterSpacing: '0.08em' }}>
          ← BACK
        </button>
        <EquiPrixLogo width={100} compact />
        <div style={{ width: 60 }} />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="text-center mb-10">
          <div className="font-cinzel text-xs tracking-widest mb-2" style={{ color: 'var(--gold)', letterSpacing: '0.2em' }}>
            LEGAL
          </div>
          <h1 className="font-cormorant text-3xl font-semibold mb-2" style={{ color: 'var(--cream)' }}>
            Terms & Conditions
          </h1>
          <p className="font-cormorant italic text-base" style={{ color: 'var(--mid)' }}>
            EquiPrix Fantasy Show Jumping Platform
          </p>
          <div className="mt-4 px-4 py-3 rounded-lg inline-block"
            style={{ background: 'rgba(76,175,125,0.08)', border: '1px solid rgba(76,175,125,0.2)' }}>
            <p className="font-cinzel text-xs tracking-widest" style={{ color: '#4caf7d', letterSpacing: '0.12em' }}>
              NO PURCHASE NECESSARY · FREE TO PLAY · NOT GAMBLING
            </p>
          </div>
        </motion.div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS.map((section, i) => (
            <motion.div key={section.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(180,149,48,0.15)', background: '#14130e' }}>
              <button
                onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-all"
                style={{ background: activeSection === section.id ? 'rgba(180,149,48,0.06)' : 'transparent' }}>
                <span className="font-cormorant text-base font-semibold" style={{ color: activeSection === section.id ? 'var(--gold-lt)' : 'var(--cream)' }}>
                  {section.title}
                </span>
                <span className="font-cinzel text-xs ml-4 flex-shrink-0" style={{ color: 'var(--mid)' }}>
                  {activeSection === section.id ? '▲' : '▼'}
                </span>
              </button>
              {activeSection === section.id && (
                <div className="px-5 pb-5 pt-1" style={{ borderTop: '1px solid rgba(180,149,48,0.1)' }}>
                  {section.content.split('\n\n').map((para, j) => (
                    <p key={j} className="font-cormorant text-sm leading-relaxed mb-3 last:mb-0"
                      style={{ color: 'rgba(242,237,226,0.75)', lineHeight: 1.7 }}>
                      {para}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-8 text-center">
          <p className="font-cormorant italic text-sm" style={{ color: 'var(--mid)' }}>
            By using EquiPrix you agree to these terms.
          </p>
          <p className="font-cormorant italic text-xs mt-1" style={{ color: 'var(--mid)', opacity: 0.6 }}>
            Questions? Contact us at info@playequiprix.com
          </p>
        </div>
      </div>
    </div>
  );
}