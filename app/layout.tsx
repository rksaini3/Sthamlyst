export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDevanagari.variable} ${plexMono.variable}`}>
      {/* 
        body में md:bg-... जोड़ने से लैपटॉप पर सुंदर बैकग्राउंड दिखेगा 
        और md:flex से आपका पूरा ऐप स्क्रीन के बिल्कुल बीच (Center) में आ जाएगा।
      */}
      <body className="min-h-dvh bg-white dark:bg-stone-950 dark:text-stone-100 font-body md:bg-stone-100 md:dark:bg-stone-900 md:flex md:justify-center md:items-start">
        <ThemeProvider>
          <AuthProvider>
            <LocationGate>
              
              {/* 
                --- मुख्य सुधार यहाँ है ---
                यह नया div आपके पूरे ऐप को लैपटॉप/डेस्कटॉप स्क्रीन पर बीच में लाएगा 
                और 'max-w-md' की वजह से इसकी चौड़ाई 448px (एक मोबाइल जैसी) फिक्स रखेगा।
                इससे DevTools बंद होने पर भी ऐप कभी ब्लैंक नहीं होगा!
              */}
              <div className="w-full max-w-md mx-auto min-h-dvh bg-white dark:bg-stone-950 shadow-2xl relative flex flex-col justify-between">
                
                <GlobalHeader />
                <ConnectivityToast />
                
                {/* मुख्य कंटेंट जो बची हुई पूरी जगह लेगा */}
                <main className="flex-1 w-full">
                  {children}
                </main>
                
                <DynamicFab />
                <BottomNav />
                <AnalyticsConsent />
                <PushInit />
                
              </div>
              {/* --- सुधार समाप्त --- */}

            </LocationGate>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
