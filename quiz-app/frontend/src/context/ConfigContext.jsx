import { createContext, useState, useEffect, useContext } from 'react';
import { getConfig } from '../services/api';

export const ConfigContext = createContext(null);

export const ConfigProvider = ({ children }) => {
    const [config, setConfig] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchConfig = async () => {
        try {
            const data = await getConfig();
            setConfig(data);
        } catch (error) {
            console.error("Failed to fetch global config:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const refreshConfig = async () => {
        await fetchConfig();
    };

    const activeTheme = config?.active_theme || "default";

    return (
        <ConfigContext.Provider value={{ config, activeTheme, isLoading, refreshConfig }}>
            {children}
        </ConfigContext.Provider>
    );
};

export const useConfig = () => {
    const context = useContext(ConfigContext);
    if (!context) {
        throw new Error("useConfig must be used within a ConfigProvider");
    }
    return context;
};
