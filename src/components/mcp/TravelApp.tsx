import { useTravelData } from './travel/useTravelData';
export default function TravelApp() {
  const { step, destination, setDestination, budget, setBudget, days, setDays, interests, setInterests, suggestions, errorMsg, handleSubmit, setStep } = useTravelData();
  return (
    <div className="h-screen flex items-start justify-center p-3 bg-transparent font-sans overflow-hidden">
      <div className="relative w-full max-w-[620px] h-full bg-[#0b1221] rounded-3xl p-[3px] shadow-xl border border-white/5 overflow-hidden flex flex-col">
        <div className="bg-[#0f1523] rounded-[1.35rem] p-5 relative overflow-hidden flex-1 flex flex-col">
          <div className="flex items-center gap-4 mb-5 shrink-0 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0" style={{ background: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)' }}>
              <span className="material-symbols-rounded text-[28px]">flight_takeoff</span>
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight" style={{ backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundImage: 'linear-gradient(to right, #fb7185, #fca5a5)' }}>Planificador de Viajes</h2>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-0.5">Impulsado por IA</p>
            </div>
          </div>
          {step === 'form' && (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 relative z-10">
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Destino</label>
                  <div className="relative">
                    <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[20px]">location_on</span>
                    <input required type="text" className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-400/50 focus:bg-[#1e293b] transition-colors placeholder:text-gray-600" placeholder="e.g. Kyoto, Japón" value={destination} onChange={e => setDestination(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Días</label>
                    <div className="relative">
                      <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[20px]">calendar_today</span>
                      <input required type="number" min="1" max="30" className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-400/50 focus:bg-[#1e293b] transition-colors placeholder:text-gray-600" value={days} onChange={e => setDays(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Presupuesto</label>
                    <div className="relative">
                      <span className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[20px]">payments</span>
                      <select className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-400/50 focus:bg-[#1e293b] transition-colors appearance-none" value={budget} onChange={e => setBudget(e.target.value)}>
                        <option value="Económico">Económico</option><option value="Standard">Standard</option><option value="Lujo">Lujo</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 ml-1">Intereses (opcional)</label>
                  <div className="relative">
                    <span className="material-symbols-rounded absolute left-3 top-3 text-gray-500 text-[20px]">star</span>
                    <textarea rows={2} className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white text-sm focus:outline-none focus:border-rose-400/50 focus:bg-[#1e293b] transition-colors placeholder:text-gray-600 resize-none" placeholder="Museos, comida local, naturaleza..." value={interests} onChange={e => setInterests(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="relative group mt-2 shrink-0">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-orange-400 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-200 pointer-events-none"></div>
                <button type="submit" disabled={!destination.trim()} className="relative w-full bg-[#1e293b]/50 hover:bg-[#1e293b] text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-200 border border-white/10 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  <span className="material-symbols-rounded text-[20px]">explore</span>
                  <span className="font-bold text-sm tracking-wide uppercase">Descubrir Aventuras</span>
                </button>
              </div>
            </form>
          )}
          {step === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 relative z-10">
              <div className="relative"><span className="material-symbols-rounded animate-spin text-rose-400 text-[48px]">autorenew</span><span className="material-symbols-rounded absolute inset-0 flex items-center justify-center text-orange-300 text-[24px]">airplanemode_active</span></div>
              <div className="text-center space-y-1"><h3 className="text-white font-semibold">Diseñando tu viaje ideal</h3><p className="text-gray-500 text-sm">Consultando agentes expertos...</p></div>
            </div>
          )}
          {step === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 relative z-10 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center"><span className="material-symbols-rounded text-red-400 text-[36px]">error</span></div>
              <div><h3 className="text-white font-semibold text-lg">Vaya, hubo un problema</h3><p className="text-gray-400 text-sm mt-1">{errorMsg}</p></div>
              <button onClick={() => setStep('form')} className="mt-2 bg-white/10 hover:bg-white/15 text-white py-2 px-6 rounded-lg text-sm font-medium transition-colors">Intentar de nuevo</button>
            </div>
          )}
          {step === 'results' && (
            <div className="flex-1 flex flex-col relative z-10 h-full overflow-hidden">
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 pb-2">
                {suggestions.map((sug, i) => (
                  <div key={sug.id || i} className="bg-[#1e293b]/30 border border-white/10 rounded-2xl p-4 hover:bg-[#1e293b]/50 transition-colors">
                    <div className="flex justify-between items-start gap-2 mb-2"><h4 className="text-white font-bold text-sm leading-tight">{sug.title}</h4><span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">{sug.estimatedCost}</span></div>
                    <p className="text-gray-400 text-xs leading-relaxed mb-3">{sug.description}</p>
                    {sug.highlights?.length > 0 && (<div className="flex flex-wrap gap-1.5">{sug.highlights.map((hl, j) => (<span key={j} className="bg-white/5 text-gray-300 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded inline-flex items-center gap-1 border border-white/5"><span className="material-symbols-rounded text-[14px] text-orange-400">push_pin</span>{hl}</span>))}</div>)}
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('form')} className="mt-4 w-full bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 border border-white/10"><span className="material-symbols-rounded text-[18px]">refresh</span>Nueva Búsqueda</button>
            </div>
          )}
          <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
