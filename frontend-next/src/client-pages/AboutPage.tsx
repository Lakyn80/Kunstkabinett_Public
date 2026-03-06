import Layout from "@/components/Layout";

const AboutPage = () => {
  return (
    <Layout>
      <div className="pt-24 md:pt-32 pb-20">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <h1 className="font-serif text-4xl md:text-5xl text-foreground mb-8">O galerii Kunstkabinett</h1>

            <div className="space-y-6 text-muted-foreground leading-relaxed">
              <p>
                Kunstkabinett je galerie současného umění v Brně, zaměřená na originální obrazy, sochy a grafiky etablovaných i nastupujících českých umělců.
              </p>
              <p>
                Firma působí od roku 2010. Zakladatel galerie se umění profesionálně věnuje již od roku 1999.
              </p>
              <p>
                Sídlíme v reprezentativních prostorách Jalta paláce v centru Brna.
              </p>
              <p>
                Věříme, že život s originálním uměním patří k velkým radostem. Naším cílem je, aby objevování, porozumění a nákup současného umění byl stejně hodnotný jako samotné dílo.
              </p>

              <div className="border-t border-border pt-8 mt-8">
                <h2 className="font-serif text-2xl text-foreground mb-4">Náš přístup</h2>
                <p>
                  Každé dílo vybíráme přísným kurátorským procesem. S autory spolupracujeme dlouhodobě, pravidelně navštěvujeme jejich ateliéry a představujeme jejich tvorbu v potřebném kontextu.
                </p>
              </div>

              <div className="border-t border-border pt-8 mt-8">
                <h2 className="font-serif text-2xl text-foreground mb-4">Služby</h2>
                <ul className="space-y-2 text-sm">
                  <li>• Soukromé prohlídky po domluvě</li>
                  <li>• Umělecké poradenství a budování sbírky</li>
                  <li>• Konzultace umění pro firmy</li>
                  <li>• Doporučení k rámování a instalaci</li>
                  <li>• Celosvětová doprava a pojištění</li>
                </ul>
              </div>

              <div className="border-t border-border pt-8 mt-8">
                <h2 className="font-serif text-2xl text-foreground mb-4">Navštivte nás</h2>
                <div className="text-sm space-y-1">
                  <p>Kunstkabinett</p>
                  <p>Dominikánské náměstí 656/2</p>
                  <p>Jalta palác</p>
                  <p>Brno</p>
                  <p>Czech Republic</p>
                </div>
              </div>

              <div className="border-t border-border pt-8 mt-8">
                <h2 className="font-serif text-2xl text-foreground mb-4">Kontaktní údaje</h2>
                <div className="text-sm space-y-1">
                  <p>Jméno: Rostislav Blaha</p>
                  <p>E-mail: info@kunstkabinett.cz</p>
                  <p>Telefon: +420 775 635 333</p>
                </div>
              </div>

              <div className="border-t border-border pt-8 mt-8">
                <h2 className="font-serif text-2xl text-foreground mb-4">Otevírací doba</h2>
                <div className="text-sm space-y-1">
                  <p>Úterý–Sobota: 11:00–18:00</p>
                  <p>Neděle–Pondělí: po domluvě</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AboutPage;
