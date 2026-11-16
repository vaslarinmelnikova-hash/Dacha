local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)

local PlayerData = {}

type Entry = {
	Items: { [string]: number },
	Tools: { [string]: boolean },
	CanSave: boolean,
}

local entries: { [Player]: Entry } = {}

local store: DataStore? = nil
do
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.Save.DataStore)
	end)
	if ok then
		store = result
	else
		warn("[PlayerData] Сохранение отключено: " .. tostring(result))
	end
end

local function key(player: Player): string
	return "player_" .. player.UserId
end

local function sync(player: Player, entry: Entry)
	for _, item in Config.Items do
		player:SetAttribute(item, entry.Items[item])
	end
end

function PlayerData.Load(player: Player)
	local saved = nil
	local canSave = store ~= nil
	if store then
		local ok, result = pcall(function()
			return store:GetAsync(key(player))
		end)
		if ok then
			saved = result
		else
			-- Saving now would overwrite real progress with an empty inventory.
			canSave = false
			warn("[PlayerData] Не удалось загрузить " .. player.Name .. ": " .. tostring(result))
		end
	end

	local entry: Entry = { Items = {}, Tools = {}, CanSave = canSave }
	for _, item in Config.Items do
		entry.Items[item] = saved and saved.Items and tonumber(saved.Items[item]) or 0
	end
	if saved and saved.Tools then
		for id in Config.Tools do
			if saved.Tools[id] then
				entry.Tools[id] = true
			end
		end
	end

	entries[player] = entry
	sync(player, entry)
end

function PlayerData.Save(player: Player)
	local entry = entries[player]
	if not entry or not entry.CanSave or not store then
		return
	end
	local ok, err = pcall(function()
		store:SetAsync(key(player), { Items = entry.Items, Tools = entry.Tools }, { player.UserId })
	end)
	if not ok then
		warn("[PlayerData] Не удалось сохранить " .. player.Name .. ": " .. tostring(err))
	end
end

function PlayerData.Remove(player: Player)
	entries[player] = nil
end

function PlayerData.GetItem(player: Player, item: string): number
	local entry = entries[player]
	return entry and entry.Items[item] or 0
end

function PlayerData.AddItem(player: Player, item: string, amount: number)
	local entry = entries[player]
	if not entry or entry.Items[item] == nil then
		return
	end
	entry.Items[item] = math.max(0, entry.Items[item] + amount)
	player:SetAttribute(item, entry.Items[item])
end

function PlayerData.CanAfford(player: Player, cost: { [string]: number }): boolean
	for item, amount in cost do
		if PlayerData.GetItem(player, item) < amount then
			return false
		end
	end
	return true
end

-- Empties the inventory and returns what was in it.
function PlayerData.TakeAllItems(player: Player): { [string]: number }
	local entry = entries[player]
	local taken = {}
	if not entry then
		return taken
	end
	for item, amount in entry.Items do
		if amount > 0 then
			taken[item] = amount
		end
		entry.Items[item] = 0
	end
	sync(player, entry)
	return taken
end

function PlayerData.OwnedTools(player: Player): { string }
	local entry = entries[player]
	local list = {}
	if entry then
		for id in entry.Tools do
			table.insert(list, id)
		end
	end
	return list
end

function PlayerData.HasTool(player: Player, id: string): boolean
	local entry = entries[player]
	return entry ~= nil and entry.Tools[id] == true
end

function PlayerData.AddTool(player: Player, id: string)
	local entry = entries[player]
	if entry then
		entry.Tools[id] = true
	end
end

function PlayerData.ClearTools(player: Player)
	local entry = entries[player]
	if entry then
		table.clear(entry.Tools)
	end
end

function PlayerData.SaveAll(players: { Player })
	for _, player in players do
		task.spawn(PlayerData.Save, player)
	end
end

return PlayerData
