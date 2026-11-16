local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")

local Config = require(ReplicatedStorage:WaitForChild("Shared"):WaitForChild("Config"))
local Remotes = ReplicatedStorage:WaitForChild("Remotes")

local player = Players.LocalPlayer
local font = Enum.Font.SourceSansBold

local gui = Instance.new("ScreenGui")
gui.Name = "HUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local function corner(parent: Instance, radius: number?)
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, radius or 8)
	c.Parent = parent
end

local function label(parent: Instance, text: string, size: number): TextLabel
	local l = Instance.new("TextLabel")
	l.BackgroundTransparency = 1
	l.Font = font
	l.TextColor3 = Color3.new(1, 1, 1)
	l.TextSize = size
	l.Text = text
	l.TextStrokeTransparency = 0.6
	l.Parent = parent
	return l
end

-- Inventory

local inventory = Instance.new("Frame")
inventory.Position = UDim2.fromOffset(16, 60)
inventory.Size = UDim2.fromOffset(190, 34 * #Config.Items + 16)
inventory.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
inventory.BackgroundTransparency = 0.35
inventory.Parent = gui
corner(inventory)

local itemLabels: { [string]: TextLabel } = {}
for i, item in Config.Items do
	local l = label(inventory, "", 22)
	l.TextXAlignment = Enum.TextXAlignment.Left
	l.Position = UDim2.fromOffset(14, 8 + (i - 1) * 34)
	l.Size = UDim2.new(1, -28, 0, 32)
	itemLabels[item] = l
end

-- Health and hunger bars

local function bar(y: number, color: Color3, title: string): (Frame, TextLabel)
	local back = Instance.new("Frame")
	back.AnchorPoint = Vector2.new(0.5, 1)
	back.Position = UDim2.new(0.5, 0, 1, y)
	back.Size = UDim2.fromOffset(320, 24)
	back.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
	back.BackgroundTransparency = 0.25
	back.Parent = gui
	corner(back, 6)

	local fill = Instance.new("Frame")
	fill.Size = UDim2.fromScale(1, 1)
	fill.BackgroundColor3 = color
	fill.Parent = back
	corner(fill, 6)

	local text = label(back, title, 18)
	text.Size = UDim2.fromScale(1, 1)
	text.ZIndex = 2
	return fill, text
end

local healthFill, healthText = bar(-48, Color3.fromRGB(200, 55, 55), "Здоровье")
local hungerFill, hungerText = bar(-18, Color3.fromRGB(220, 140, 40), "Голод")

local function setBar(fill: Frame, text: TextLabel, title: string, value: number, max: number)
	local ratio = math.clamp(value / max, 0, 1)
	fill.Size = UDim2.fromScale(ratio, 1)
	fill.Visible = ratio > 0
	text.Text = string.format("%s: %d", title, math.ceil(value))
end

local function watchHumanoid(character: Model)
	local humanoid = character:WaitForChild("Humanoid") :: Humanoid
	local function update()
		setBar(healthFill, healthText, "Здоровье", humanoid.Health, humanoid.MaxHealth)
	end
	humanoid.HealthChanged:Connect(update)
	update()
end

player.CharacterAdded:Connect(watchHumanoid)
if player.Character then
	task.spawn(watchHumanoid, player.Character)
end

-- Crafting

local craftPanel = Instance.new("Frame")
craftPanel.AnchorPoint = Vector2.new(1, 0.5)
craftPanel.Position = UDim2.new(1, -16, 0.5, 0)
craftPanel.Size = UDim2.fromOffset(320, 56 + #Config.Recipes * 64)
craftPanel.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
craftPanel.BackgroundTransparency = 0.2
craftPanel.Visible = false
craftPanel.Parent = gui
corner(craftPanel)

local craftTitle = label(craftPanel, "Крафт", 26)
craftTitle.Size = UDim2.new(1, 0, 0, 44)

local function costText(cost: { [string]: number }): string
	local parts = {}
	for _, item in Config.Items do
		if cost[item] then
			table.insert(parts, string.format("%s %d", Config.ItemNames[item], cost[item]))
		end
	end
	return table.concat(parts, ", ")
end

local recipeButtons: { [TextButton]: { [string]: number } } = {}
for i, recipe in Config.Recipes do
	local button = Instance.new("TextButton")
	button.Position = UDim2.fromOffset(12, 44 + (i - 1) * 64)
	button.Size = UDim2.new(1, -24, 0, 56)
	button.Font = font
	button.TextSize = 20
	button.TextColor3 = Color3.new(1, 1, 1)
	button.Text = recipe.Display .. "\n" .. costText(recipe.Cost)
	button.AutoButtonColor = true
	button.Parent = craftPanel
	corner(button, 6)
	button.Activated:Connect(function()
		Remotes.Action:FireServer("Craft", recipe.Id)
	end)
	recipeButtons[button] = recipe.Cost
end

local function refreshInventory()
	for item, l in itemLabels do
		l.Text = string.format("%s: %d", Config.ItemNames[item], player:GetAttribute(item) or 0)
	end
	for button, cost in recipeButtons do
		local affordable = true
		for item, amount in cost do
			if (player:GetAttribute(item) or 0) < amount then
				affordable = false
			end
		end
		button.BackgroundColor3 = affordable and Color3.fromRGB(60, 120, 60) or Color3.fromRGB(70, 70, 75)
	end
end

local function refreshHunger()
	setBar(hungerFill, hungerText, "Голод", player:GetAttribute("Hunger") or 0, Config.Survival.MaxHunger)
end

for _, item in Config.Items do
	player:GetAttributeChangedSignal(item):Connect(refreshInventory)
end
player:GetAttributeChangedSignal("Hunger"):Connect(refreshHunger)
refreshInventory()
refreshHunger()

-- Notifications

local feed = Instance.new("Frame")
feed.AnchorPoint = Vector2.new(0.5, 1)
feed.Position = UDim2.new(0.5, 0, 1, -110)
feed.Size = UDim2.fromOffset(400, 200)
feed.BackgroundTransparency = 1
feed.Parent = gui

local layout = Instance.new("UIListLayout")
layout.VerticalAlignment = Enum.VerticalAlignment.Bottom
layout.HorizontalAlignment = Enum.HorizontalAlignment.Center
layout.Padding = UDim.new(0, 4)
layout.Parent = feed

local function showNotice(text: string)
	local l = label(feed, text, 22)
	l.Size = UDim2.new(1, 0, 0, 26)
	task.delay(1.5, function()
		local tween = TweenService:Create(l, TweenInfo.new(0.6), { TextTransparency = 1, TextStrokeTransparency = 1 })
		tween.Completed:Connect(function()
			l:Destroy()
		end)
		tween:Play()
	end)
end

Remotes.Notify.OnClientEvent:Connect(showNotice)

local function button(parent: Instance, text: string, color: Color3): TextButton
	local b = Instance.new("TextButton")
	b.Font = font
	b.TextSize = 18
	b.TextColor3 = Color3.new(1, 1, 1)
	b.Text = text
	b.BackgroundColor3 = color
	b.Parent = parent
	corner(b, 6)
	return b
end

-- Chests and loot bags

local rowHeight = 40
local containerPanel = Instance.new("Frame")
containerPanel.AnchorPoint = Vector2.new(0.5, 0.5)
containerPanel.Position = UDim2.fromScale(0.5, 0.45)
containerPanel.Size = UDim2.fromOffset(460, 110 + #Config.Items * rowHeight)
containerPanel.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
containerPanel.BackgroundTransparency = 0.15
containerPanel.Visible = false
containerPanel.Parent = gui
corner(containerPanel)

local containerTitle = label(containerPanel, "", 24)
containerTitle.Size = UDim2.new(1, 0, 0, 40)

local header = label(containerPanel, "у тебя / внутри", 16)
header.Position = UDim2.fromOffset(150, 34)
header.Size = UDim2.fromOffset(110, 20)
header.TextTransparency = 0.3

local openId: string? = nil
local openItems: { [string]: number } = {}
local openModel: Model? = nil
local countLabels: { [string]: TextLabel } = {}

for i, item in Config.Items do
	local y = 56 + (i - 1) * rowHeight
	local name = label(containerPanel, Config.ItemNames[item], 20)
	name.TextXAlignment = Enum.TextXAlignment.Left
	name.Position = UDim2.fromOffset(16, y)
	name.Size = UDim2.fromOffset(140, rowHeight - 6)

	local count = label(containerPanel, "", 20)
	count.Position = UDim2.fromOffset(150, y)
	count.Size = UDim2.fromOffset(110, rowHeight - 6)
	countLabels[item] = count

	local store = button(containerPanel, "Положить", Color3.fromRGB(70, 90, 140))
	store.Position = UDim2.fromOffset(266, y)
	store.Size = UDim2.fromOffset(90, rowHeight - 8)
	store.Activated:Connect(function()
		Remotes.Action:FireServer("Store", openId, item)
	end)

	local take = button(containerPanel, "Взять", Color3.fromRGB(60, 120, 60))
	take.Position = UDim2.fromOffset(362, y)
	take.Size = UDim2.fromOffset(82, rowHeight - 8)
	take.Activated:Connect(function()
		Remotes.Action:FireServer("Take", openId, item)
	end)
end

local closeButton = button(containerPanel, "Закрыть", Color3.fromRGB(110, 50, 50))
closeButton.AnchorPoint = Vector2.new(0.5, 1)
closeButton.Position = UDim2.new(0.5, 0, 1, -10)
closeButton.Size = UDim2.fromOffset(140, 34)

local function refreshContainer()
	if not openId then
		return
	end
	for item, count in countLabels do
		count.Text = string.format("%d / %d", player:GetAttribute(item) or 0, openItems[item] or 0)
	end
end

local function closeContainer(tellServer: boolean)
	if openId and tellServer then
		Remotes.Action:FireServer("CloseContainer", openId)
	end
	openId, openModel = nil, nil
	containerPanel.Visible = false
end

closeButton.Activated:Connect(function()
	closeContainer(true)
end)

for _, item in Config.Items do
	player:GetAttributeChangedSignal(item):Connect(refreshContainer)
end

Remotes.Container.OnClientEvent:Connect(function(action: string, id: string, items: any, title: string?, model: Model?)
	if action == "Open" then
		openId, openItems, openModel = id, items, model
		containerTitle.Text = title or ""
		containerPanel.Visible = true
		refreshContainer()
	elseif action == "Update" and id == openId then
		openItems = items
		refreshContainer()
	elseif action == "Close" and id == openId then
		closeContainer(false)
	end
end)

task.spawn(function()
	while true do
		task.wait(0.3)
		if openId then
			local root = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
			local model = openModel
			if not root or not model or not model.Parent or (model:GetPivot().Position - root.Position).Magnitude > 14 then
				closeContainer(true)
			end
		end
	end
end)

-- Shop

local shopPanel = Instance.new("Frame")
shopPanel.AnchorPoint = Vector2.new(0.5, 0.5)
shopPanel.Position = UDim2.fromScale(0.5, 0.45)
shopPanel.Size = UDim2.fromOffset(420, 100 + #Config.GamePasses * 90)
shopPanel.BackgroundColor3 = Color3.fromRGB(25, 25, 30)
shopPanel.BackgroundTransparency = 0.15
shopPanel.Visible = false
shopPanel.Parent = gui
corner(shopPanel)

local shopTitle = label(shopPanel, "Магазин", 26)
shopTitle.Size = UDim2.new(1, 0, 0, 44)

local buyButtons: { [string]: TextButton } = {}

for i, pass in Config.GamePasses do
	local y = 48 + (i - 1) * 90
	local title = label(shopPanel, pass.Display, 22)
	title.TextXAlignment = Enum.TextXAlignment.Left
	title.Position = UDim2.fromOffset(16, y)
	title.Size = UDim2.fromOffset(250, 26)

	local description = label(shopPanel, pass.Description, 16)
	description.TextXAlignment = Enum.TextXAlignment.Left
	description.TextYAlignment = Enum.TextYAlignment.Top
	description.TextWrapped = true
	description.Position = UDim2.fromOffset(16, y + 28)
	description.Size = UDim2.fromOffset(260, 50)

	local buy = button(shopPanel, "Купить", Color3.fromRGB(200, 150, 40))
	buy.Position = UDim2.fromOffset(290, y + 14)
	buy.Size = UDim2.fromOffset(114, 40)
	buy.Activated:Connect(function()
		if player:GetAttribute(pass.Key) then
			return
		end
		if pass.Id == 0 then
			showNotice("Этот Game Pass ещё не настроен (Config.GamePasses)")
			return
		end
		MarketplaceService:PromptGamePassPurchase(player, pass.Id)
	end)
	buyButtons[pass.Key] = buy
end

local shopClose = button(shopPanel, "Закрыть", Color3.fromRGB(110, 50, 50))
shopClose.AnchorPoint = Vector2.new(0.5, 1)
shopClose.Position = UDim2.new(0.5, 0, 1, -10)
shopClose.Size = UDim2.fromOffset(140, 34)
shopClose.Activated:Connect(function()
	shopPanel.Visible = false
end)

local shopButton = button(gui, "Магазин", Color3.fromRGB(200, 150, 40))
shopButton.AnchorPoint = Vector2.new(1, 0)
shopButton.Position = UDim2.new(1, -16, 0, 60)
shopButton.Size = UDim2.fromOffset(120, 38)
shopButton.TextSize = 20
shopButton.Activated:Connect(function()
	shopPanel.Visible = not shopPanel.Visible
end)

local vipBadge = label(gui, "VIP", 22)
vipBadge.Position = UDim2.fromOffset(16, 70 + inventory.Size.Y.Offset)
vipBadge.Size = UDim2.fromOffset(60, 26)
vipBadge.TextColor3 = Color3.fromRGB(255, 200, 60)
vipBadge.Visible = false

local function refreshPasses()
	for _, pass in Config.GamePasses do
		local owned = player:GetAttribute(pass.Key) == true
		buyButtons[pass.Key].Text = owned and "Куплено" or "Купить"
		buyButtons[pass.Key].AutoButtonColor = not owned
	end
	vipBadge.Visible = player:GetAttribute("VIP") == true
end

for _, pass in Config.GamePasses do
	player:GetAttributeChangedSignal(pass.Key):Connect(refreshPasses)
end
refreshPasses()

-- Controls

local hint = label(gui, "ЛКМ — бить   |   C — крафт   |   F — поесть   |   E — открыть", 18)
hint.AnchorPoint = Vector2.new(0.5, 1)
hint.Position = UDim2.new(0.5, 0, 1, -78)
hint.Size = UDim2.fromOffset(600, 24)
hint.TextTransparency = 0.2

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.C then
		craftPanel.Visible = not craftPanel.Visible
	elseif input.KeyCode == Enum.KeyCode.F then
		Remotes.Action:FireServer("Eat")
	end
end)
