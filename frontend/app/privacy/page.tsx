import type { Metadata } from "next";
import LegalPage from "../_landing/LegalPage";
import { REPO } from "../_landing/Chrome";

export const metadata: Metadata = { title: "Neighbor · Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 24, 2026">
      <section>
        <h2>The short version</h2>
        <p>Neighbor has no accounts, no cookies, no analytics and no ads. We don&apos;t ask for your name or email, and we don&apos;t sell or share personal information.</p>
      </section>
      <section>
        <h2>What happens when you use the simulator</h2>
        <ul>
          <li>When you search for a town, the text you type is sent from our server to the OpenStreetMap Nominatim service to find matching places. Your IP address is not passed along.</li>
          <li>When you open a town for the first time, its coordinates are sent from our server to the FCC Census Area API to find its county, and map data for the area is downloaded from Overture Maps.</li>
          <li>Downloaded towns are saved on our server so they load faster next time. That saved map is shared by every visitor and is not linked to you.</li>
          <li>The town you are viewing appears in the page address, so it shows up in your browser history.</li>
          <li>Settings you choose in the simulator, such as size or cooling, stay in your browser tab. They are not saved or sent anywhere.</li>
        </ul>
      </section>
      <section>
        <h2>Server logs</h2>
        <p>Like most websites, the service that hosts Neighbor may keep standard request logs, such as IP address, browser type and the time of a request, for security and to keep the site running.</p>
      </section>
      <section>
        <h2>Changes and contact</h2>
        <p>If this changes, for example if we add analytics, we will update this page and the date at the top. Questions can be opened as an issue on <a href={`${REPO}/issues`}>GitHub</a>.</p>
      </section>
    </LegalPage>
  );
}
