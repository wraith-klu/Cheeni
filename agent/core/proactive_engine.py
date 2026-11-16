"""
Cheeni Core — Proactive Intelligence & Telemetry Forecasting (Capability 8)
Anticipates system anomalies, battery depletion, and memory saturation
using Chronos-T5 probabilistic time-series forecasting.
"""

import logging
import os
from typing import List, Dict
import numpy as np
import psutil
from config.constants import HF_MODELS

logger = logging.getLogger("cheeni.proactive")


class ProactiveIntelligenceEngine:
    """
    Amazon Chronos-T5 Time-Series Forecaster.
    Forecasts laptop telemetry trajectories and triggers proactive JARVIS suggestions.
    """

    def __init__(self):
        self.pipeline = None
        self.history_cpu = []
        self.history_ram = []
        self._load_chronos_pipeline()

    def _load_chronos_pipeline(self):
        try:
            from chronos import ChronosPipeline
            import torch
            model_id = HF_MODELS.get("proactive", "wraithklu/cheeni-proactive-chronos_08")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.pipeline = ChronosPipeline.from_pretrained(
                model_id,
                device_map=device,
                torch_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float32,
            )
            logger.info(f"✅ Chronos Proactive Forecaster loaded on {device}: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ Chronos forecaster standby ({e}) — using exponential smoothing fallback")
            self.pipeline = None

    def record_current_telemetry(self):
        """Records current system state."""
        cpu = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory().percent
        self.history_cpu.append(cpu)
        self.history_ram.append(ram)
        # Keep sliding window of 64 steps
        if len(self.history_cpu) > 64:
            self.history_cpu.pop(0)
        if len(self.history_ram) > 64:
            self.history_ram.pop(0)

    def forecast_metric(self, historical_values: List[float], prediction_length: int = 12) -> np.ndarray:
        """
        Forecasts next `prediction_length` time steps using Chronos-T5.
        Returns median trajectory array of shape (prediction_length,).
        """
        if len(historical_values) < 5:
            return np.array([historical_values[-1] if historical_values else 0.0] * prediction_length)

        if self.pipeline is not None:
            try:
                import torch
                context = torch.tensor(historical_values, dtype=torch.float32)
                forecast = self.pipeline.predict(context, prediction_length=prediction_length)
                # forecast has shape (num_samples, prediction_length) -> extract median (50th percentile)
                median_forecast = np.quantile(forecast[0].numpy(), 0.5, axis=0)
                return median_forecast
            except Exception as e:
                logger.error(f"Chronos forecast error: {e}")

        # Statistical fallback: linear trend extrapolation
        recent = np.array(historical_values[-10:])
        slope = (recent[-1] - recent[0]) / max(len(recent) - 1, 1)
        extrapolated = [recent[-1] + slope * (i + 1) for i in range(prediction_length)]
        return np.clip(np.array(extrapolated), 0.0, 100.0)

    def evaluate_proactive_risks(self) -> Dict:
        """
        Scans future trajectories and returns proactive JARVIS suggestions.
        """
        self.record_current_telemetry()
        forecast_cpu = self.forecast_metric(self.history_cpu, prediction_length=12)
        forecast_ram = self.forecast_metric(self.history_ram, prediction_length=12)

        alerts = []
        if np.max(forecast_ram) > 90.0:
            alerts.append("⚠️ Memory saturation predicted (>90% in ~20 mins). Recommend closing unused background tabs.")

        if np.max(forecast_cpu) > 85.0:
            alerts.append("🔥 CPU spike predicted (>85%). Background compilation or heavy processes active.")

        battery = psutil.sensors_battery()
        if battery and not battery.power_plugged and battery.percent < 25:
            alerts.append(f"🔋 Battery at {battery.percent}%. Recommend plugging in charger soon.")

        return {
            "current_cpu": self.history_cpu[-1] if self.history_cpu else 0.0,
            "current_ram": self.history_ram[-1] if self.history_ram else 0.0,
            "forecast_cpu": [float(x) for x in forecast_cpu],
            "forecast_ram": [float(x) for x in forecast_ram],
            "alerts": alerts,
            "proactive_action_needed": len(alerts) > 0
        }


_proactive_engine = None

def get_proactive_engine() -> ProactiveIntelligenceEngine:
    global _proactive_engine
    if _proactive_engine is None:
        _proactive_engine = ProactiveIntelligenceEngine()
    return _proactive_engine
