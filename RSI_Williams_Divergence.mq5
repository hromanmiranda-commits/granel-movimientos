//+------------------------------------------------------------------+
//|                                            RSI_Williams_Divergence.mq5 |
//|                        Copyright 2026, Hector (MT5)             |
//|   Detecta cruces divergentes entre RSI(3) y Williams %R(3) y muestra
//|   las últimas 5 flechas en el gráfico (dirección del %R).       |
//+------------------------------------------------------------------+
#property indicator_chart_window
#property indicator_buffers 2           // buffers para flechas
#property indicator_plots   2

//--- buffers (se usan para dibujar flechas)
double ArrowUp[];   // flecha ↑ (dirección alcista del %R)
double ArrowDown[]; // flecha ↓ (dirección bajista del %R)

//--- historial de cruces (máximo 5)
static int recentCrossIdx[5]; // índice de barra del cruce
static int recentCrossDir[5]; // 1 = ↑ , -1 = ↓

//--- símbolos de flecha (Wingdings)
#define ARROW_UP   159   // ↑
#define ARROW_DOWN 158   // ↓

//--- parámetros de entrada
input int    rsi_period   = 3;          // periodo RSI
input int    wr_period    = 3;          // periodo %R
input int    shift_back   = 1;          // barras a mirar para la dirección del %R
input double arrow_offset = 10;        // número de puntos para separar la flecha del precio

//--- handles de los indicadores internos
int rsi_handle;
int wr_handle;

//+------------------------------------------------------------------+
int OnInit()
  {
   //--- asignar buffers y estilo
   SetIndexBuffer(0, ArrowUp, INDICATOR_DATA);
   SetIndexStyle(0, DRAW_ARROW, STYLE_SOLID, 2, clrLime);
   SetIndexArrow(0, ARROW_UP);
   SetIndexLabel(0, "Divergencia ↑");

   SetIndexBuffer(1, ArrowDown, INDICATOR_DATA);
   SetIndexStyle(1, DRAW_ARROW, STYLE_SOLID, 2, clrRed);
   SetIndexArrow(1, ARROW_DOWN);
   SetIndexLabel(1, "Divergencia ↓");

   //--- crear indicadores auxiliares
   rsi_handle = iRSI(_Symbol, _Period, rsi_period, PRICE_CLOSE);
   if(rsi_handle == INVALID_HANDLE)
     {
      Print("Error creando handle RSI");
      return(INIT_FAILED);
     }
   // Williams %R en MQL5 se llama iWPR
   wr_handle = iWPR(_Symbol, _Period, wr_period);
   if(wr_handle == INVALID_HANDLE)
     {
      Print("Error creando handle %R");
      return(INIT_FAILED);
     }

   //--- inicializar historial (valor -1 indica posición vacía)
   for(int i = 0; i < 5; i++)
     {
      recentCrossIdx[i] = -1;
      recentCrossDir[i] = 0;
     }

   return(INIT_SUCCEEDED);
  }
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   if(rsi_handle != INVALID_HANDLE) IndicatorRelease(rsi_handle);
   if(wr_handle  != INVALID_HANDLE) IndicatorRelease(wr_handle);
  }
//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const int begin,
                const double &price[])
  {
   int minBars = MathMax(rsi_period, wr_period) + 1;
   if(rates_total < minBars) return(0);

   //--- obtener series temporales de los indicadores
   double rsi[]; double wr[];
   ArraySetAsSeries(rsi, true);
   ArraySetAsSeries(wr,  true);
   CopyBuffer(rsi_handle, 0, 0, rates_total, rsi);
   CopyBuffer(wr_handle , 0, 0, rates_total, wr );

   //--- limpiar buffers (se volverán a rellenar solo con los últimos 5 cruces)
   for(int i = 0; i < rates_total; i++)
     {
      ArrowUp[i]   = EMPTY_VALUE;
      ArrowDown[i] = EMPTY_VALUE;
     }

   int start = (prev_calculated == 0) ? minBars : prev_calculated - 1;

   //--- detectar cruces en todas las barras
   for(int i = start; i < rates_total; i++)
     {
      double diff_curr = rsi[i] - wr[i];
      double diff_prev = rsi[i-1] - wr[i-1];
      if(diff_curr == 0) continue;               // evitar división por cero
      bool crossed = (diff_curr * diff_prev < 0); // cambio de signo → cruce
      if(!crossed) continue;

      //--- dirección del %R en la barra "shift_back" posterior
      double wr_now    = wr[i];
      double wr_future = wr[i + shift_back];
      int dir = 0; // 1 = ↑ , -1 = ↓
      if(wr_future > wr_now) dir = 1;
      else if(wr_future < wr_now) dir = -1;
      if(dir == 0) continue; // sin cambio significativo

      //--- actualizar historial desplazando a la izquierda y añadiendo el nuevo
      for(int h = 0; h < 4; h++)
        {
         recentCrossIdx[h] = recentCrossIdx[h+1];
         recentCrossDir[h] = recentCrossDir[h+1];
        }
      recentCrossIdx[4] = i;   // posición más reciente
      recentCrossDir[4] = dir;
     }

   //--- dibujar flechas solo para los últimos 5 cruces almacenados
   for(int h = 0; h < 5; h++)
     {
      int idx = recentCrossIdx[h];
      if(idx == -1) continue; // posición vacía
      if(recentCrossDir[h] == 1)
         ArrowUp[idx] = iLow(_Symbol, _Period, idx) - (Point * arrow_offset);
      else if(recentCrossDir[h] == -1)
         ArrowDown[idx] = iHigh(_Symbol, _Period, idx) + (Point * arrow_offset);
     }

   return(rates_total);
  }
//+------------------------------------------------------------------+
