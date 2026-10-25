import type { Metadata } from "next";
import LegalPage from "../_landing/LegalPage";
import { REPO } from "../_landing/Chrome";

export const metadata: Metadata = { title: "dcsim · Terms of use" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of use" updated="October 24, 2026">
      <section>
        <h2>What dcsim is</h2>
        <p>dcsim is a free student prototype built at HackOhio 2026. It estimates how a data center might affect a town&apos;s water, power bills, schools and taxes, noise, land and jobs. By using the site you agree to these terms.</p>
      </section>
      <section>
        <h2>Estimates, not advice</h2>
        <p>Everything dcsim shows is a model estimate. It is not engineering, financial, tax or legal advice, and it is not an official forecast from any government or company. Some numbers in the current version are placeholder demo values, and the simulator labels them that way. Check anything important against official sources before relying on it.</p>
      </section>
      <section>
        <h2>Data from other organizations</h2>
        <p>The maps use data from the Overture Maps Foundation, which includes data from OpenStreetMap contributors and other sources, each under its own license. Town search uses the OpenStreetMap Nominatim service, and county lookups use the FCC Census Area API. Those organizations&apos; terms and licenses apply to their data. We make no claim of ownership over it.</p>
      </section>
      <section>
        <h2>Fair use of the site</h2>
        <ul>
          <li>Please don&apos;t send automated or bulk requests. Town search depends on a shared public service with strict limits.</li>
          <li>Don&apos;t try to break, overload or get around the site&apos;s limits.</li>
          <li>Don&apos;t present dcsim results as official findings.</li>
        </ul>
      </section>
      <section>
        <h2>The code</h2>
        <p>The source code is available under the MIT License on <a href={REPO}>GitHub</a>.</p>
      </section>
      <section>
        <h2>No warranty</h2>
        <p>The site is provided as is, without any warranty. To the extent the law allows, the people who built it are not liable for any loss that comes from using it or relying on its results. The site may change or go offline at any time.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>We may update these terms, and the date at the top will change when we do. Questions can be opened as an issue on <a href={`${REPO}/issues`}>GitHub</a>.</p>
      </section>
    </LegalPage>
  );
}
