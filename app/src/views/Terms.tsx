// Terms of use and disclaimer, opened from the Details drawer. Visible text approved word for word by ninja on
// 14 Nov 2026 (source: docs/event/terms-draft.md). Do not change a sentence without ninja's approval.
import { forwardRef } from 'react'

export const Terms = forwardRef<HTMLElement>(function Terms(_props, ref) {
  return (
    <section ref={ref} id="terms" className="drawer-sec terms" aria-labelledby="sec-terms" data-testid="terms">
      <h3 id="sec-terms">Terms of use</h3>
      <p>
        <strong>Lunar Landing Site Navigator</strong> is a student project by team SFZ | MEXG for the NASA Space Apps
        Challenge 2026 (local event Heilbronn).
      </p>
      <p>
        <strong>Not NASA.</strong> This app is not made, endorsed or reviewed by NASA or ESA. It uses public NASA data;
        the use of that data does not imply endorsement.
      </p>
      <p>
        <strong>Not for real missions.</strong> The app is a learning and exploration tool. Its results come from public
        data and our own calculations; some have been checked by team members, none are certified. Do not use them to
        plan, fly or make safety decisions for a real mission. Sunlight, Earth visibility, slope, shadow and temperature
        values have stated limits; where data is missing the app says "unknown".
      </p>
      <p>
        <strong>No warranty.</strong> The app is provided as is, without any warranty. We are not liable for decisions
        made on the basis of its results, to the extent the law allows.
      </p>
      <p>
        <strong>Your privacy.</strong> The app has no accounts and collects nothing about you: no cookies, no tracking,
        no analytics. Your saved missions and the Full data setting are kept only in your own browser&apos;s local storage;
        they never leave your device, and clearing your browser data removes them. Like any website, the hosting provider
        (Cloudflare) processes technical request data such as your IP address to deliver the pages.
      </p>
      <p>
        <strong>Data and credits.</strong>
      </p>
      <ul>
        <li>
          Terrain: LRO LOLA, Barker et al. 2023 (doi:10.3847/PSJ/acf3e1; data doi:10.60903/gsfcpgda-lola-spole), NASA
          Goddard PGDA; LOLA 5 m polar map, NASA Planetary Data System.
        </li>
        <li>
          Sunlight and permanent shadow: LOLA average illumination maps, Mazarico et al. 2011
          (doi:10.1016/j.icarus.2010.10.030), NASA PDS.
        </li>
        <li>Temperature: LRO Diviner Polar Resource Product, Paige et al., LRO-L-DLRE-5-PRP-V2.0, NASA PDS, 2018.</li>
        <li>Sun and Earth positions: NASA/JPL NAIF SPICE kernels.</li>
        <li>Moon and star imagery: NASA's Scientific Visualization Studio (CGI Moon Kit; Deep Star Maps 2020).</li>
        <li>Site coordinates and research facts: the source linked next to each value in the app.</li>
      </ul>
      <p>
        <strong>AI use.</strong> Parts of the code, data processing and text were written with AI coding assistants and
        checked by team members.
      </p>
      <p>
        <strong>Code licence.</strong> The source code is open source under the Apache License 2.0. Third-party data
        keeps its own terms and citations.
      </p>
      <p>
        <strong>Contact.</strong> Team SFZ | MEXG, via the NASA Space Apps Challenge 2026 project page.
      </p>
    </section>
  )
})
