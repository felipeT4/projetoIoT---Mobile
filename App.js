import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';

// Troque somente pelo endereço que o celular ou emulador consegue acessar.
// Não acrescente /api no final.
const API_BASE_URL = 'http://10.137.11.6';

const PALETTE = {
  light: {
    background: '#F3F6FC',
    surface: '#FFFFFF',
    surfaceAlt: '#EDF2FA',
    text: '#14223A',
    muted: '#718096',
    primary: '#2F63E9',
    primarySoft: '#E8EEFF',
    border: '#E2E9F3',
    active: '#177A4A',
    activeSoft: '#E5F6ED',
    inactive: '#627187',
    inactiveSoft: '#EDF1F6',
    error: '#A83C35',
    errorSoft: '#FCEBE9',
    hero: '#285FD9',
  },
  dark: {
    background: '#0B1220',
    surface: '#121C2D',
    surfaceAlt: '#1B2940',
    text: '#F0F5FF',
    muted: '#A1AEC2',
    primary: '#83A7FF',
    primarySoft: '#1C2D50',
    border: '#29374D',
    active: '#57D18C',
    activeSoft: '#173425',
    inactive: '#B6C1D1',
    inactiveSoft: '#273449',
    error: '#FF9A91',
    errorSoft: '#3A2425',
    hero: '#1A478E',
  },
};

// Lê a resposta JSON e apresenta erro claro caso o servidor retorne conteúdo inválido.
async function readJson(response ) {
  const text = await response.text();

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('A API retornou uma resposta inválida.');
  }
}

function getResponseMessage(body, fallback) {
  if (body && typeof body.error === 'string') return body.error;
  if (body && typeof body.message === 'string') return body.message;
  if (body && typeof body.success === 'string') return body.success;
  return fallback;
}

// Converte representações equivalentes para o status binário usado pelo app:
// 1 = ativo; 0 = desativado.
function normalizeStatus(value) {
  if (value === 1 || value === true) return 1;
  if (value === 0 || value === false) return 0;

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'ativo', 'active', 'true', 'on'].includes(normalized)) {
      return 1;
    }

    if (
      [
        '0',
        'desativado',
        'desativada',
        'inativo',
        'inativa',
        'inactive',
        'false',
        'off',
      ].includes(normalized)
    ) {
      return 0;
    }
  }

  return null;
}

// Indicador visual reutilizado nos cartões e na tela de detalhes.
function StatusBadge({ status, colors }) {
  const active = status === 1;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: active ? colors.activeSoft : colors.inactiveSoft,
        },
      ]}
    >
      <View
        style={[
          styles.badgeDot,
          {
            backgroundColor: active ? colors.active : colors.inactive,
          },
        ]}
      />
      <Text
        style={[
          styles.badgeText,
          { color: active ? colors.active : colors.inactive },
        ]}
      >
        {active ? 'Ativo' : 'Desativado'}
      </Text>
    </View>
  );
}

// Cabeçalho compartilhado entre listagem e detalhes.
function Header({ colors, isDark, onToggleTheme, showingDetails, onBack }) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <View style={styles.headerBrand}>
        {showingDetails ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a lista"
            style={styles.backButton}
          >
            <Text style={[styles.backArrow, { color: colors.primary }]}>‹</Text>
          </Pressable>
        ) : (
          <View style={[styles.brandMark, { backgroundColor: colors.hero }]}>
            <Text style={styles.brandMarkText}>S</Text>
          </View>
        )}

        <View>
          <Text style={[styles.brandName, { color: colors.text }]}>
            PROJETO IOT
          </Text>
          <Text style={[styles.brandCaption, { color: colors.muted }]}>
            {showingDetails ? 'Detalhes do sensor' : 'Painel de sensores'}
          </Text>
        </View>
      </View>

      <View style={styles.themeControl}>
        <Text style={[styles.themeLabel, { color: colors.muted }]}>
          {isDark ? 'Escuro' : 'Claro'}
        </Text>
        <Switch
          accessibilityLabel="Alternar tema claro e escuro"
          value={isDark}
          onValueChange={onToggleTheme}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#FFFFFF"
        />
      </View>
    </View>
  );
}

// Tela de listagem e filtros.
function SensorListScreen({
  colors,
  sensors,
  loading,
  refreshing,
  error,
  filter,
  onFilter,
  onRefresh,
  onRetry,
  onSelect,
}) {
  const visibleSensors = useMemo(() => {
    if (filter === 'all') return sensors;
    return sensors.filter((sensor) => sensor.status === filter);
  }, [filter, sensors]);

  const activeCount = sensors.filter((sensor) => sensor.status === 1).length;
  const inactiveCount = sensors.length - activeCount;

  const filters = [
    { label: 'Todos', value: 'all' },
    { label: 'Ativos', value: 1 },
    { label: 'Desativados', value: 0 },
  ];

  const renderSensor = ({ item, index }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${item.tipo}, código ${item.codigo}`}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.sensorCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.sensorIcon,
          {
            backgroundColor:
              index % 2 === 0 ? colors.primarySoft : colors.surfaceAlt,
          },
        ]}
      >
        <Text style={[styles.sensorIconText, { color: colors.primary }]}>
          {String(item.tipo || 'S').slice(0, 1).toUpperCase()}
        </Text>
      </View>

      <View style={styles.sensorCopy}>
        <Text
          style={[styles.sensorType, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.tipo}
        </Text>
        <Text style={[styles.sensorCode, { color: colors.muted }]}>
          {item.codigo}
        </Text>
      </View>

      <StatusBadge status={item.status} colors={colors} />
      <Text style={[styles.chevron, { color: colors.muted }]}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <Text style={[styles.pageTitle, { color: colors.text }]}>
        Seus sensores
      </Text>
      <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
        Acompanhe e gerencie seus dispositivos
      </Text>

      <View style={[styles.summaryCard, { backgroundColor: colors.hero }]}>
        <Text style={styles.summaryEyebrow}>VISÃO GERAL</Text>
        <Text style={styles.summaryTitle}>Sua rede em um olhar</Text>

        <View style={styles.summaryDivider} />

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{sensors.length}</Text>
            <Text style={styles.metricLabel}>Total</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{activeCount}</Text>
            <Text style={styles.metricLabel}>Ativos</Text>
          </View>
          <View style={styles.metricRule} />
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{inactiveCount}</Text>
            <Text style={styles.metricLabel}>Desativados</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Dispositivos
          </Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            {sensors.length} sensores cadastrados
          </Text>
        </View>

        <Pressable
          onPress={onRefresh}
          accessibilityRole="button"
          accessibilityLabel="Atualizar lista"
          style={styles.refreshButton}
        >
          <Text style={{ color: colors.primary, fontSize: 25 }}>↻</Text>
        </Pressable>
      </View>

      <View style={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.value;

          return (
            <Pressable
              key={String(item.value)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onFilter(item.value)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selected ? '#FFFFFF' : colors.muted },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.stateText, { color: colors.muted }]}>
            Carregando sensores…
          </Text>
        </View>
      ) : error ? (
        <View
          style={[
            styles.messageCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            Não foi possível conectar
          </Text>
          <Text style={[styles.stateText, { color: colors.muted }]}>
            {error}
          </Text>
          <Pressable
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={visibleSensors}
          keyExtractor={(item) => item.codigo}
          renderItem={renderSensor}
          contentContainerStyle={
            visibleSensors.length ? styles.listContent : styles.emptyContent
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View
              style={[
                styles.messageCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                {sensors.length
                  ? 'Nenhum sensor neste filtro'
                  : 'Nenhum sensor encontrado'}
              </Text>
              <Text style={[styles.stateText, { color: colors.muted }]}>
                {sensors.length
                  ? 'Escolha outro filtro para continuar.'
                  : 'Verifique a conexão com a API e atualize a lista.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// Consulta o sensor ao abrir os detalhes e confirma o PUT com um novo GET.
function SensorDetailsScreen({ sensor, colors, onChanged }) {
  const [status, setStatus] = useState(sensor.status);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sensor/status/visualizar/${encodeURIComponent(sensor.codigo)}`,
        { headers: { Accept: 'application/json' } },
      );
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getResponseMessage(
            body,
            response.status === 404
              ? 'Sensor não encontrado.'
              : `Falha ao consultar (HTTP ${response.status}).`,
          ),
        );
      }

      const currentStatus = normalizeStatus(
        body?.status ?? body?.data?.status ?? body?.sensor?.status,
      );

      if (currentStatus === null) {
        throw new Error('A API retornou um status diferente de 0 ou 1.');
      }

      setStatus(currentStatus);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível consultar este sensor.',
      );
    } finally {
      setLoading(false);
    }
  }, [sensor.codigo]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const updateStatus = async () => {
    const nextStatus = status === 1 ? 0 : 1;

    setUpdating(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sensor/status/atualizar`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codigo: sensor.codigo,
            status: nextStatus,
          }),
        },
      );
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getResponseMessage(
            body,
            `Falha ao atualizar (HTTP ${response.status}).`,
          ),
        );
      }

      // A rota pode responder 200 sem efetivar a mudança; confirmamos com GET.
      const verifyResponse = await fetch(
        `${API_BASE_URL}/api/sensor/status/visualizar/${encodeURIComponent(sensor.codigo)}`,
        { headers: { Accept: 'application/json' } },
      );
      const verifyBody = await readJson(verifyResponse);
      const confirmedStatus = normalizeStatus(
        verifyBody?.status ??
          verifyBody?.data?.status ??
          verifyBody?.sensor?.status,
      );

      if (!verifyResponse.ok || confirmedStatus !== nextStatus) {
        throw new Error('A API não confirmou a alteração do status.');
      }

      setStatus(confirmedStatus);
      setNotice(
        `Status confirmado como ${
          confirmedStatus === 1 ? 'ativo' : 'desativado'
        }.`,
      );
      onChanged();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível atualizar o status.',
      );
    } finally {
      setUpdating(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text
        style={[
          styles.pageTitle,
          { color: colors.text, textTransform: 'capitalize' },
        ]}
      >
        {sensor.tipo}
      </Text>
      <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
        Consulte as informações e controle o dispositivo
      </Text>

      <View style={[styles.detailHero, { backgroundColor: colors.hero }]}>
        <Text style={styles.summaryEyebrow}>STATUS DO SENSOR</Text>

        {loading ? (
          <ActivityIndicator
            color="#FFFFFF"
            size="large"
            style={styles.detailLoader}
          />
        ) : (
          <View style={styles.detailStatusRow}>
            <Text style={styles.detailStatus}>
              {status === 1 ? 'Ativo' : 'Desativado'}
            </Text>
            <Text style={styles.valuePill}>VALOR {status}</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.codeCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.sensorIcon,
            { backgroundColor: colors.primarySoft },
          ]}
        >
          <Text style={[styles.sensorIconText, { color: colors.primary }]}>
            #
          </Text>
        </View>

        <View style={styles.sensorCopy}>
          <Text style={[styles.infoLabel, { color: colors.muted }]}>
            CÓDIGO DO SENSOR
          </Text>
          <Text style={[styles.sensorType, { color: colors.text }]}>
            {sensor.codigo}
          </Text>
        </View>

        {!loading && <StatusBadge status={status} colors={colors} />}
      </View>

      {!!error && (
        <View
          style={[
            styles.messageCard,
            styles.inlineMessage,
            { backgroundColor: colors.errorSoft, borderColor: colors.errorSoft },
          ]}
        >
          <Text style={[styles.errorText, { color: colors.error }]}>
            {error}
          </Text>
          <Pressable onPress={loadStatus} style={styles.retryLink}>
            <Text style={[styles.retryLinkText, { color: colors.primary }]}>
              Consultar novamente
            </Text>
          </Pressable>
        </View>
      )}

      {!!notice && (
        <Text
          style={[
            styles.notice,
            { color: colors.active, backgroundColor: colors.activeSoft },
          ]}
        >
          {notice}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={loading || updating}
        onPress={updateStatus}
        style={[
          styles.actionButton,
          {
            backgroundColor: status === 1 ? colors.surface : colors.primary,
            borderColor: status === 1 ? colors.border : colors.primary,
          },
          (loading || updating) && styles.disabled,
        ]}
      >
        {updating ? (
          <ActivityIndicator
            color={status === 1 ? colors.primary : '#FFFFFF'}
          />
        ) : (
          <Text
            style={[
              styles.actionText,
              { color: status === 1 ? colors.error : '#FFFFFF' },
            ]}
          >
            {status === 1 ? 'Desativar sensor' : 'Ativar sensor'}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.helper, { color: colors.muted }]}>
        A mudança só é indicada como concluída após uma nova consulta à API.
      </Text>
    </View>
  );
}

export default function App() {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemScheme === 'dark');
  const [sensors, setSensors] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const colors = isDark ? PALETTE.dark : PALETTE.light;

  // GET /listar carrega e normaliza os sensores retornados pela API.
  const loadSensors = useCallback(async (pullToRefresh) => {
    if (pullToRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/sensor/status/listar`,
        { headers: { Accept: 'application/json' } },
      );
      const body = await readJson(response);

      if (!response.ok) {
        throw new Error(
          getResponseMessage(
            body,
            `Falha ao listar sensores (HTTP ${response.status}).`,
          ),
        );
      }

      // Aceita o contrato documentado e alguns nomes comuns de envelope.
      const rawSensors = Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body?.sensors)
          ? body.sensors
          : Array.isArray(body?.sensores)
            ? body.sensores
            : Array.isArray(body?.data?.sensors)
              ? body.data.sensors
              : Array.isArray(body?.data?.sensores)
                ? body.data.sensores
                : null;

      if (!rawSensors) {
        throw new Error(
          'A resposta da API não contém uma lista de sensores em data.',
        );
      }

      const invalidSensors = [];

      const normalizedSensors = rawSensors.flatMap((sensor, index) => {
        if (!sensor || typeof sensor !== 'object') {
          invalidSensors.push({ index, sensor });
          return [];
        }

        const rawCode =
          sensor.codigo ??
          sensor.codigo_sensor ??
          sensor.code ??
          sensor.id;

        const rawType =
          sensor.tipo ??
          sensor.tipo_sensor ??
          sensor.type ??
          sensor.nome;

        const status = normalizeStatus(
          sensor.status ?? sensor.ativo ?? sensor.active,
        );

        const codigo = rawCode == null ? '' : String(rawCode).trim();
        const tipo =
          typeof rawType === 'string' && rawType.trim()
            ? rawType.trim()
            : 'Sensor';

        // Não inventa status. Ignora registros sem código ou status reconhecível.
        if (!codigo || status === null) {
          invalidSensors.push({ index, sensor });
          return [];
        }

        return [{ codigo, tipo, status }];
      });

      // Registros válidos continuam aparecendo; os inválidos ficam visíveis no console.
      if (invalidSensors.length > 0) {
        console.warn('Registros de sensor ignorados:', invalidSensors);
      }

      if (rawSensors.length > 0 && normalizedSensors.length === 0) {
        throw new Error(
          'A API retornou sensores, mas nenhum tinha código e status 0/1 reconhecíveis. Veja o console do Expo.',
        );
      }

      setSensors(normalizedSensors);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar os sensores.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Carrega a lista ao abrir o app e após uma atualização feita nos detalhes.
  useEffect(() => {
    loadSensors(false);
  }, [loadSensors, reloadKey]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.app, { backgroundColor: colors.background }]}>
        <Header
          colors={colors}
          isDark={isDark}
          onToggleTheme={setIsDark}
          showingDetails={!!selectedSensor}
          onBack={() => setSelectedSensor(null)}
        />

        {selectedSensor ? (
          <SensorDetailsScreen
            key={selectedSensor.codigo}
            sensor={selectedSensor}
            colors={colors}
            onChanged={() =>
              setReloadKey((current) => current + 1)
            }
          />
        ) : (
          <SensorListScreen
            colors={colors}
            sensors={sensors}
            loading={loading}
            refreshing={refreshing}
            error={error}
            filter={filter}
            onFilter={setFilter}
            onRefresh={() => loadSensors(true)}
            onRetry={() => loadSensors(false)}
            onSelect={setSelectedSensor}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// Todos os estilos ficam neste mesmo App.js.
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  header: {
    minHeight: 68,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  brandMarkText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  brandCaption: {
    fontSize: 11,
    marginTop: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  backArrow: {
    fontSize: 32,
    lineHeight: 36,
  },
  themeControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 5,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 17,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    marginBottom: 17,
  },
  summaryCard: {
    borderRadius: 21,
    padding: 18,
    marginBottom: 20,
  },
  summaryEyebrow: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginVertical: 15,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11,
    marginTop: 2,
  },
  metricRule: {
    width: 1,
    height: 31,
    backgroundColor: 'rgba(255,255,255,0.24)',
    marginHorizontal: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 3,
  },
  refreshButton: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  filters: {
    flexDirection: 'row',
    marginBottom: 13,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 22,
  },
  emptyContent: {
    flexGrow: 1,
  },
  sensorCard: {
    minHeight: 72,
    borderRadius: 17,
    borderWidth: 1,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
  },
  sensorIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  sensorIconText: {
    fontSize: 21,
    fontWeight: '800',
  },
  sensorCopy: {
    flex: 1,
    marginRight: 8,
  },
  sensorType: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  sensorCode: {
    fontSize: 11,
    marginTop: 4,
  },
  chevron: {
    fontSize: 24,
    marginLeft: 7,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stateBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  stateText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  messageCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginTop: 4,
  },
  stateTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 10,
    marginTop: 14,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  detailHero: {
    borderRadius: 21,
    padding: 19,
    marginBottom: 13,
    minHeight: 120,
  },
  detailLoader: {
    marginTop: 23,
    alignSelf: 'flex-start',
  },
  detailStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  detailStatus: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '800',
  },
  valuePill: {
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.17)',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '800',
  },
  codeCard: {
    borderWidth: 1,
    borderRadius: 17,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  inlineMessage: {
    marginTop: 13,
    alignItems: 'flex-start',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
  },
  retryLink: {
    marginTop: 9,
  },
  retryLinkText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notice: {
    marginTop: 13,
    borderRadius: 12,
    padding: 12,
    fontSize: 12,
    lineHeight: 18,
  },
  actionButton: {
    minHeight: 52,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 19,
    paddingHorizontal: 18,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  helper: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
});
