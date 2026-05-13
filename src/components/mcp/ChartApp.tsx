import { useChartData } from './chart/useChartData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';

export default function ChartApp() {
  const { data, errorMsg, loading } = useChartData();

  let xAxisKey = 'name';
  const numericKeys: string[] = [];
  if (data && data.length > 0) {
    const sample = data[0];
    let foundX = false;
    for (const key of Object.keys(sample)) {
      if (!foundX && (key === 'name' || typeof sample[key] === 'string')) { xAxisKey = key; foundX = true; }
      else if (typeof sample[key] === 'number') numericKeys.push(key);
    }
    if (numericKeys.length === 0 && 'value' in sample) numericKeys.push('value');
  }

  const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="h-screen flex items-start justify-center p-3 bg-transparent font-sans overflow-hidden">
      <div className="relative w-full max-w-[800px] h-full bg-[#0b1221] rounded-3xl p-[3px] shadow-xl border border-white/5 overflow-hidden flex flex-col">
        <div className="bg-[#0f1523] rounded-[1.35rem] p-5 relative overflow-hidden flex-1 flex flex-col">
          <div className="flex items-center gap-4 mb-4 shrink-0 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)' }}>
              <span className="material-symbols-rounded text-[28px]">bar_chart</span>
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight" style={{ backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundImage: 'linear-gradient(to right, #93c5fd, #c4b5fd)' }}>Gráfico Dinámico</h2>
              <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase mt-0.5">Generado a partir de la conversación</p>
            </div>
          </div>

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 relative z-10">
              <span className="material-symbols-rounded animate-spin text-blue-400 text-[40px]">autorenew</span>
              <p className="text-gray-400 text-sm font-medium">Procesando datos...</p>
            </div>
          )}

          {!loading && errorMsg && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 relative z-10 text-center px-4">
              <span className="material-symbols-rounded text-rose-400 text-[40px] mb-2">error</span>
              <p className="text-white text-sm font-medium">{errorMsg}</p>
            </div>
          )}

          {!loading && !errorMsg && data && data.length > 0 && (
            <div className="flex-1 relative z-10 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                  <defs>{colors.map((color, i) => (<linearGradient key={`grad-${i}`} id={`colorGrad${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.8} /><stop offset="95%" stopColor={color} stopOpacity={0.2} /></linearGradient>))}</defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey={xAxisKey} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} contentStyle={{ backgroundColor: 'rgba(15, 21, 35, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 500 }} />
                  {numericKeys.map((key, i) => (<Bar key={key} dataKey={key} fill={`url(#colorGrad${i % colors.length})`} radius={[6, 6, 0, 0]} barSize={40}>{data.map((_, index) => (<Cell key={`cell-${index}`} fill={`url(#colorGrad${(index + i) % colors.length})`} />))}</Bar>))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
}
